import { Hono } from "hono";
import type { Context, Next } from "hono";
import { bodyLimit } from "hono/body-limit";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { adminJs, appCss, guestJs } from "./assets";
import type { Config } from "./config";
import { hmacBase64url, randomPin, randomToken, safeEqual } from "./crypto";
import { isDoor, isEntryAction } from "./doors";
import type { Door, DoorAction, Doors } from "./doors";
import { checkLocation } from "./geo";
import { isLang, pickLang, texts } from "./i18n";
import type { Lang, Texts } from "./i18n";
import type { Notifier } from "./notify";
import type { Stay, Store } from "./store";
import { PERMANENT_UNTIL, stayStatus } from "./store";
import { LoginThrottle } from "./throttle";
import { formatDateTime, localInputToEpoch } from "./time";
import { adminPage, doorsPage, guestMessagePage, loginPage, logPage, pinPage } from "./views";

const MAX_PIN_ATTEMPTS = 5;
const PIN_LOCK_MS = 15 * 60_000;
const DOOR_COOLDOWN_MS = 4_000;
const LOGIN_FAILURE_DELAY_MS = 1_000;
const SESSION_COOKIE = "go_session";
const ADMIN_COOKIE = "go_admin";
const LANG_COOKIE = "go_lang";
const ADMIN_SESSION_S = 30 * 86_400;
// Browsers cap cookie lifetimes at 400 days, so admin users re-enter their PIN about once a year.
const MAX_COOKIE_AGE_S = 400 * 86_400;

const CSP = [
  "default-src 'none'",
  "script-src 'self'",
  "style-src 'self'",
  "img-src 'self' data:",
  "connect-src 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "base-uri 'none'",
].join("; ");

const ASSETS: Record<string, { body: string; type: string }> = {
  "app.css": { body: appCss, type: "text/css; charset=utf-8" },
  "guest.js": { body: guestJs, type: "text/javascript; charset=utf-8" },
  "admin.js": { body: adminJs, type: "text/javascript; charset=utf-8" },
};

function parseDoorAction(value: unknown): DoorAction | null {
  if (value === undefined) return "open";
  return value === "open" || value === "unlock" || value === "lock" ? value : null;
}

/**
 * Address of the visitor, for the login lockout.
 * Nginx Proxy Manager overwrites X-Real-IP with the real client. A client-supplied
 * CF-Connecting-IP is ignored: nothing in front of us strips that header, so it can be spoofed.
 * Without a proxy (LAN test, port unpublished) every client shares the "direct" bucket.
 */
function clientAddress(c: Context): string {
  const real = c.req.header("x-real-ip")?.trim();
  if (real) return real;
  const forwarded = c.req.header("x-forwarded-for");
  if (forwarded) {
    const hops = forwarded.split(",").map((part) => part.trim()).filter(Boolean);
    if (hops.length > 0) return hops[hops.length - 1];
  }
  return "direct";
}

/** The proxy terminates TLS and forwards plain HTTP, so the original scheme comes from X-Forwarded-Proto. */
function isHttps(c: Context): boolean {
  return c.req.header("x-forwarded-proto") === "https" || new URL(c.req.url).protocol === "https:";
}

function publicOrigin(cfg: Config, c: Context): string {
  if (cfg.publicUrl) return cfg.publicUrl;
  const url = new URL(c.req.url);
  return `${isHttps(c) ? "https" : url.protocol.slice(0, -1)}://${url.host}`;
}

export function createApp(cfg: Config, store: Store, doors: Doors, notifier: Pick<Notifier, "send">) {
  const app = new Hono();
  const loginThrottle = new LoginThrottle();

  app.use("*", async (c, next) => {
    // The Origin header can't be compared to the request URL: dev servers and reverse proxies rewrite the host.
    if (c.req.method === "POST" && c.req.header("sec-fetch-site") === "cross-site") {
      return c.text("Forbidden", 403);
    }
    await next();
    if (!c.res.headers.has("Cache-Control")) c.header("Cache-Control", "no-store");
    c.header("Content-Security-Policy", CSP);
    c.header("Permissions-Policy", "geolocation=(self), camera=(), microphone=(), payment=()");
    c.header("Referrer-Policy", "no-referrer");
    c.header("X-Robots-Tag", "noindex, nofollow");
    c.header("X-Content-Type-Options", "nosniff");
    c.header("X-Frame-Options", "DENY");
    if (isHttps(c)) c.header("Strict-Transport-Security", "max-age=31536000");
  });

  // Every legitimate request is a short form or JSON body.
  app.use("*", bodyLimit({ maxSize: 16 * 1024, onError: (c) => c.text("Payload too large", 413) }));

  app.get("/", (c) => c.text("Nothing to see here.", 404));
  app.get("/healthz", (c) => c.text("ok"));

  app.get("/assets/:file", (c) => {
    const asset = ASSETS[c.req.param("file")];
    if (!asset) return c.notFound();
    c.header("Content-Type", asset.type);
    // URLs carry a content hash (?v=…), so they can be cached for long.
    c.header("Cache-Control", "public, max-age=604800, immutable");
    return c.body(asset.body);
  });

  // -------------------------------------------------------------- guest

  /** A ?lang= choice is remembered, otherwise it would be lost on the redirect after the PIN form. */
  function guestLang(c: Context): { lang: Lang; t: Texts } {
    const query = c.req.query("lang");
    if (isLang(query)) {
      setCookie(c, LANG_COOKIE, query, { path: "/", maxAge: 365 * 86_400, sameSite: "Lax", secure: isHttps(c) });
    }
    const lang = pickLang(c.req.header("accept-language"), isLang(query) ? query : getCookie(c, LANG_COOKIE));
    return { lang, t: texts[lang] };
  }

  // Including the PIN means issuing a new PIN logs out every existing session.
  const sessionValue = (stay: Stay) =>
    hmacBase64url(cfg.sessionSecret, `${stay.token}|${stay.pin}|${stay.valid_until}`);

  async function hasSession(c: Context, stay: Stay): Promise<boolean> {
    const cookie = getCookie(c, SESSION_COOKIE);
    return !!cookie && safeEqual(cookie, await sessionValue(stay));
  }

  /** Returns the stay if it is currently usable, otherwise a rendered explanation page. */
  function loadActiveStay(c: Context, token: string): Stay | Response {
    const { lang, t } = guestLang(c);
    const stay = store.getStay(token);
    if (!stay) return c.html(guestMessagePage(cfg, t, lang, t.invalidLink, "🔗"), 404);
    switch (stayStatus(stay)) {
      case "revoked":
        return c.html(guestMessagePage(cfg, t, lang, t.revoked, "⛔"), 403);
      case "upcoming":
        return c.html(
          guestMessagePage(cfg, t, lang, t.upcoming(formatDateTime(stay.valid_from, cfg.timezone, t.locale)), "🗓️"),
        );
      case "expired":
        return c.html(guestMessagePage(cfg, t, lang, t.expired, "👋"), 410);
    }
    return stay;
  }

  app.get("/g/:token", async (c) => {
    const { lang, t } = guestLang(c);
    const token = c.req.param("token");
    const stay = loadActiveStay(c, token);
    if (stay instanceof Response) return stay;
    if (await hasSession(c, stay)) {
      return c.html(doorsPage(cfg, t, lang, stay, `/g/${token}/door`));
    }
    return c.html(pinPage(cfg, t, lang, stay, `/g/${token}/pin`));
  });

  app.post("/g/:token/pin", async (c) => {
    const { lang, t } = guestLang(c);
    const token = c.req.param("token");
    const stay = loadActiveStay(c, token);
    if (stay instanceof Response) return stay;
    const action = `/g/${token}/pin`;

    if (stay.locked_until && stay.locked_until > Date.now()) {
      const until = formatDateTime(stay.locked_until, cfg.timezone, t.locale);
      return c.html(pinPage(cfg, t, lang, stay, action, t.locked(until)), 429);
    }

    const form = await c.req.parseBody();
    const pin = String(form.pin ?? "").replace(/\D/g, "");
    if (!safeEqual(pin, stay.pin)) {
      const { attempts, lockedUntil } = store.recordFailedAttempt(token, MAX_PIN_ATTEMPTS, PIN_LOCK_MS);
      if (lockedUntil) {
        notifier.send(
          "Guest Opener: PIN gesperrt",
          `Der Link von ${stay.guest_name} wurde nach ${MAX_PIN_ATTEMPTS} falschen PINs für 15 Minuten gesperrt.`,
        );
      }
      const error = lockedUntil
        ? t.locked(formatDateTime(lockedUntil, cfg.timezone, t.locale))
        : t.wrongPin(MAX_PIN_ATTEMPTS - attempts);
      return c.html(pinPage(cfg, t, lang, stay, action, error), 401);
    }

    if (stay.failed_attempts) store.resetAttempts(token);
    setCookie(c, SESSION_COOKIE, await sessionValue(stay), {
      path: `/g/${token}`,
      httpOnly: true,
      secure: isHttps(c),
      sameSite: "Lax",
      maxAge: Math.min(MAX_COOKIE_AGE_S, Math.max(60, Math.floor((stay.valid_until - Date.now()) / 1000))),
    });
    return c.redirect(`/g/${token}`, 303);
  });

  app.post("/g/:token/door", async (c) => {
    const { t } = guestLang(c);
    const stay = store.getStay(c.req.param("token"));
    if (!stay || stayStatus(stay) !== "active" || !(await hasSession(c, stay))) {
      return c.json({ ok: false, message: t.sessionExpired }, 401);
    }

    const body = await c.req.json<Record<string, unknown>>().catch(() => ({}) as Record<string, unknown>);
    const door = body.door;
    const action = parseDoorAction(body.action);
    if (!isDoor(door) || !action || !doors.allows(door, action)) {
      return c.json({ ok: false, message: t.doorError }, 400);
    }
    const name = doors.title(door);
    const log = { door, action, guest_name: stay.guest_name, at: Date.now() };
    const success =
      action === "lock" ? t.lockedDoor(name) : action === "unlock" ? t.unlocked(name) : doors.buzzes(door) ? t.openedBuzzer(name) : t.openedLatch(name);

    if (!isEntryAction(action)) {
      // Locking can't let anyone in, so it skips the location check: a guest who forgot to lock can do it from anywhere.
      const result = await doors.operate(door, action);
      store.logAccess({ ...log, success: result.ok, detail: result.detail, distance_m: null });
      if (!result.ok) return c.json({ ok: false, message: t.doorError }, 502);
      return c.json({ ok: true, message: success });
    }

    const loc = checkLocation(cfg, body.lat, body.lon, body.accuracy);
    const distance_m = loc.distance ?? null;
    if (!loc.ok) {
      store.logAccess({ ...log, success: false, detail: `location ${loc.reason}`, distance_m });
      if (loc.reason === "too_far") {
        notifier.send(
          "Guest Opener: Öffnen abgelehnt",
          `${stay.guest_name} wollte „${name}“ aus ${((distance_m ?? 0) / 1000).toFixed(1)} km Entfernung öffnen.`,
        );
      }
      const message = loc.reason === "too_far" ? t.tooFar : loc.reason === "inaccurate" ? t.inaccurate : t.geoUnavailable;
      return c.json({ ok: false, message }, 403);
    }

    // Guests tend to double-tap; re-triggering the buzzer or latch within seconds is pointless.
    const last = stay.last_open[door];
    if (last && Date.now() - last < DOOR_COOLDOWN_MS) return c.json({ ok: true, message: success });

    const result = await doors.operate(door, action);
    store.logAccess({ ...log, success: result.ok, detail: result.detail, distance_m });
    if (!result.ok) {
      notifier.send("Guest Opener: Tür reagiert nicht", `${name} (${stay.guest_name}): ${result.detail}`);
      return c.json({ ok: false, message: t.doorError }, 502);
    }
    const firstOpen = stay.role === "guest" && !stay.last_open.house && !stay.last_open.apartment;
    store.markOpened(stay.token, door, Date.now());
    if (firstOpen) {
      const verb = action === "unlock" ? "aufgesperrt" : "geöffnet";
      notifier.send(
        "Guest Opener: Gast angekommen",
        `${stay.guest_name} hat zum ersten Mal ${name} ${verb}${distance_m === null ? "" : ` (${distance_m} m entfernt)`}.`,
      );
    }
    return c.json({ ok: true, message: success });
  });

  // -------------------------------------------------------------- admin

  // Including the password means changing it logs out every admin session.
  const adminSignature = (exp: number) => hmacBase64url(cfg.sessionSecret, `admin|${cfg.adminPassword}|${exp}`);

  async function isAdmin(c: Context): Promise<boolean> {
    const [expStr, sig] = (getCookie(c, ADMIN_COOKIE) ?? "").split(".");
    const exp = Number(expStr);
    if (!sig || !(exp > Date.now())) return false;
    return safeEqual(sig, await adminSignature(exp));
  }

  app.get("/admin/login", (c) => c.html(loginPage(cfg)));

  app.post("/admin/login", async (c) => {
    const client = clientAddress(c);
    const lockedUntil = loginThrottle.lockedUntil(client);
    if (lockedUntil) {
      const until = formatDateTime(lockedUntil, cfg.timezone, "de-DE");
      return c.html(loginPage(cfg, `Zu viele Fehlversuche. Anmeldung erst wieder ab ${until} möglich.`), 429);
    }
    const form = await c.req.parseBody();
    if (!safeEqual(String(form.password ?? ""), cfg.adminPassword)) {
      const lock = loginThrottle.fail(client);
      if (lock) {
        notifier.send(
          "Guest Opener: Admin-Login gesperrt",
          lock === "global"
            ? "Sehr viele falsche Admin-Passwörter – die Anmeldung ist für alle 15 Minuten gesperrt."
            : `Mehrere falsche Admin-Passwörter von ${client} – diese Adresse ist 15 Minuten gesperrt.`,
        );
      }
      await new Promise((r) => setTimeout(r, LOGIN_FAILURE_DELAY_MS));
      return c.html(loginPage(cfg, "Falsches Passwort."), 401);
    }
    loginThrottle.succeed(client);
    const exp = Date.now() + ADMIN_SESSION_S * 1000;
    setCookie(c, ADMIN_COOKIE, `${exp}.${await adminSignature(exp)}`, {
      path: "/admin",
      httpOnly: true,
      secure: isHttps(c),
      sameSite: "Strict",
      maxAge: ADMIN_SESSION_S,
    });
    return c.redirect("/admin", 303);
  });

  app.post("/admin/logout", (c) => {
    deleteCookie(c, ADMIN_COOKIE, { path: "/admin" });
    return c.redirect("/admin/login", 303);
  });

  const requireAdmin = async (c: Context, next: Next) => {
    if (c.req.path === "/admin/login") return next();
    if (!(await isAdmin(c))) return c.redirect("/admin/login", 303);
    await next();
  };
  app.use("/admin", requireAdmin);
  app.use("/admin/*", requireAdmin);

  const backToAdmin = (c: Context, msg: string) => c.redirect(`/admin?msg=${encodeURIComponent(msg)}`, 303);

  app.get("/admin", async (c) => {
    const [house, apartment] = await Promise.all([
      doors.enabled("house") ? doors.battery("house") : Promise.resolve(null),
      doors.enabled("apartment") ? doors.battery("apartment") : Promise.resolve(null),
    ]);
    return c.html(
      adminPage(cfg, store.listStays("guest"), store.listStays("admin"), { house, apartment }, publicOrigin(cfg, c), c.req.query("msg")),
    );
  });

  app.get("/admin/log", (c) => c.html(logPage(cfg, store.recentLog(100))));

  app.post("/admin/stays", async (c) => {
    const form = await c.req.parseBody();
    const name = String(form.guest_name ?? "").trim().slice(0, 80);
    const from = localInputToEpoch(String(form.valid_from ?? ""), cfg.timezone);
    const until = localInputToEpoch(String(form.valid_until ?? ""), cfg.timezone);
    if (!name || from === null || until === null) return backToAdmin(c, "Bitte alle Felder ausfüllen.");
    if (until <= from) return backToAdmin(c, "Die Abreise muss nach der Anreise liegen.");
    store.createStay({ role: "guest", guest_name: name, token: randomToken(), pin: randomPin(), valid_from: from, valid_until: until });
    return backToAdmin(c, `Aufenthalt für ${name} angelegt.`);
  });

  app.post("/admin/admins", async (c) => {
    const form = await c.req.parseBody();
    const name = String(form.name ?? "").trim().slice(0, 80);
    if (!name) return backToAdmin(c, "Bitte einen Namen angeben.");
    store.createStay({
      role: "admin",
      guest_name: name,
      token: randomToken(),
      pin: randomPin(),
      valid_from: Date.now(),
      valid_until: PERMANENT_UNTIL,
    });
    return backToAdmin(c, `Admin-Nutzer ${name} angelegt.`);
  });

  app.post("/admin/stays/:token/revoke", (c) => {
    store.setRevoked(c.req.param("token"), true);
    return backToAdmin(c, "Zugang widerrufen.");
  });

  app.post("/admin/stays/:token/restore", (c) => {
    store.setRevoked(c.req.param("token"), false);
    return backToAdmin(c, "Zugang reaktiviert.");
  });

  app.post("/admin/stays/:token/new-pin", (c) => {
    store.setPin(c.req.param("token"), randomPin());
    return backToAdmin(c, "Neuer PIN erzeugt. Bitte die neue Nachricht verschicken.");
  });

  app.post("/admin/stays/:token/unlock", (c) => {
    store.resetAttempts(c.req.param("token"));
    return backToAdmin(c, "PIN-Sperre aufgehoben.");
  });

  app.post("/admin/stays/:token/delete", (c) => {
    store.deleteStay(c.req.param("token"));
    return backToAdmin(c, "Zugang gelöscht.");
  });

  app.post("/admin/test/:door/:action", async (c) => {
    const door = c.req.param("door");
    const action = parseDoorAction(c.req.param("action"));
    if (!isDoor(door) || !action || !doors.allows(door, action)) return backToAdmin(c, "Diese Türaktion ist nicht eingestellt.");
    const result = await doors.operate(door, action);
    store.logAccess({
      at: Date.now(),
      door,
      action,
      guest_name: null,
      success: result.ok,
      detail: `admin test: ${result.detail}`,
      distance_m: null,
    });
    return backToAdmin(c, result.ok ? `Tür ausgelöst (${result.detail}).` : `Fehler: ${result.detail}`);
  });

  return app;
}
