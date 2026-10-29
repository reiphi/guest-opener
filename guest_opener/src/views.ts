import { ASSET_VERSION } from "./assets";
import type { Config } from "./config";
import { DOORS, doorActions, doorBuzzes, doorEnabled, doorTitle, isLow } from "./doors";
import type { BatteryStatus, Door, DoorAction } from "./doors";
import { geofenceEnabled } from "./geo";
import type { Lang, Texts } from "./i18n";
import type { LogEntry, Stay } from "./store";
import { stayStatus } from "./store";
import { epochToLocalInput, formatDateTime, formatShort, localTimeOnDay } from "./time";

export function esc(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function jsonForScript(value: unknown): string {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

const FAVICON = `data:image/svg+xml,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">🏡</text></svg>`,
)}`;

function page(opts: { title: string; body: string; lang?: Lang; script?: "guest" | "admin" }): string {
  const script = opts.script ? `<script src="/assets/${opts.script}.js?v=${ASSET_VERSION}" defer></script>` : "";
  return `<!doctype html>
<html lang="${opts.lang ?? "de"}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="robots" content="noindex,nofollow">
<meta name="theme-color" content="#1c1c1c">
<title>${esc(opts.title)}</title>
<link rel="icon" href="${FAVICON}">
<link rel="stylesheet" href="/assets/app.css?v=${ASSET_VERSION}">
${script}
</head>
<body>${opts.body}</body>
</html>`;
}

// ---------------------------------------------------------------- guest

function helpLink(cfg: Config, t: Texts): string {
  const tel = cfg.hostPhone.replace(/[^+\d]/g, "");
  if (!tel) return "";
  return `<a class="help" href="tel:${esc(tel)}">
  <span class="help-icon" aria-hidden="true">📞</span>
  <span><small>${esc(t.help)}</small><strong>${esc(t.callUs)}: ${esc(cfg.hostPhone)}</strong></span>
</a>`;
}

function brand(cfg: Config): string {
  return `<div class="brand"><span aria-hidden="true">🏡</span>${esc(cfg.propertyName)}</div>`;
}

export function guestMessagePage(cfg: Config, t: Texts, lang: Lang, message: string, icon = "🔑"): string {
  return page({
    title: cfg.propertyName,
    lang,
    body: `<main class="guest">
${brand(cfg)}
<div class="card message-card">
  <div class="message-icon" aria-hidden="true">${icon}</div>
  <p>${esc(message)}</p>
</div>
${helpLink(cfg, t)}
</main>`,
  });
}

export function pinPage(cfg: Config, t: Texts, lang: Lang, stay: Stay, action: string, error?: string): string {
  return page({
    title: cfg.propertyName,
    lang,
    script: "guest",
    body: `<main class="guest">
${brand(cfg)}
<h1>${esc(t.welcome(stay.guest_name))}</h1>
<form class="card" method="post" action="${esc(action)}">
  <label for="pin">${esc(t.enterPin)}</label>
  ${error ? `<p class="notice err" role="alert">${esc(error)}</p>` : ""}
  <input id="pin" class="pin-input" name="pin" inputmode="numeric" pattern="[0-9]{6}" maxlength="6"
    autocomplete="one-time-code" placeholder="••••••" autofocus required aria-label="${esc(t.pinLabel)}">
  <button class="btn primary block" type="submit">${esc(t.submit)}</button>
  <p class="muted small">${esc(t.pinHint)}</p>
</form>
${helpLink(cfg, t)}
</main>`,
  });
}

function doorButton(door: Door, action: DoorAction, icon: string, label: string, sub: string): string {
  const cls = action === "lock" ? "lock" : door;
  return `<button class="door ${cls}" data-door="${door}" data-action="${action}">
  <span class="door-icon" aria-hidden="true">${icon}</span>
  <span class="door-text"><strong>${esc(label)}</strong><small>${esc(sub)}</small></span>
  <span class="door-state" aria-hidden="true"></span>
</button>`;
}

function guestDoorButtons(cfg: Config, t: Texts): string {
  const iconFor = (door: Door, action: DoorAction) => (action === "lock" ? "🔒" : door === "house" ? "🏠" : "🚪");
  return DOORS.flatMap((door) =>
    doorActions(cfg, door).map((action) => {
      const name = doorTitle(cfg, door);
      if (action === "lock") return doorButton(door, action, iconFor(door, action), t.lock(name), t.lockSub);
      if (action === "unlock") return doorButton(door, action, iconFor(door, action), t.unlock(name), t.unlockSub);
      const sub = doorBuzzes(cfg, door) ? t.openBuzzerSub : t.openLatchSub;
      return doorButton(door, action, iconFor(door, action), t.open(name), sub);
    }),
  ).join("\n  ");
}

export function doorsPage(cfg: Config, t: Texts, lang: Lang, stay: Stay, doorUrl: string): string {
  const geofence = geofenceEnabled(cfg);
  const canLock = DOORS.some((door) => doorActions(cfg, door).includes("lock"));
  const strings = {
    locating: t.locating,
    opening: t.opening,
    unlocking: t.unlocking,
    locking: t.locking,
    geoDenied: t.geoDenied,
    geoUnavailable: t.geoUnavailable,
    network: t.network,
    sessionExpired: t.sessionExpired,
  };
  const validity =
    stay.role === "admin" ? t.validForever : t.validUntil(formatDateTime(stay.valid_until, cfg.timezone, t.locale));
  const steps = [
    ["👆", t.stepDoor],
    ...(geofence ? [["📍", t.stepLocation]] : []),
    ...(canLock ? [["🔒", t.stepLeave]] : []),
  ];
  return page({
    title: cfg.propertyName,
    lang,
    script: "guest",
    body: `<main class="guest">
${brand(cfg)}
<h1>${esc(t.welcome(stay.guest_name))}</h1>
<p class="chip">${esc(validity)}</p>
<div class="doors">
  ${guestDoorButtons(cfg, t)}
</div>
<div id="status" class="status" role="status" aria-live="polite" hidden></div>
<ul class="steps">
  ${steps.map(([icon, text]) => `<li><span aria-hidden="true">${icon}</span><span>${esc(text)}</span></li>`).join("\n  ")}
</ul>
${helpLink(cfg, t)}
</main>
<script type="application/json" id="cfg">${jsonForScript({ doorUrl, geofence, strings })}</script>`,
  });
}

// ---------------------------------------------------------------- admin

const statusLabel = { active: "aktiv", upcoming: "kommend", expired: "abgelaufen", revoked: "widerrufen" } as const;
const actionLabel = { open: "öffnen", unlock: "aufsperren", lock: "zusperren" } as const;

/** Instructions follow the configured doors, so the copied message matches the buttons. */
function guestInstructions(cfg: Config, lang: Lang): string {
  const lines = DOORS.filter((door) => doorEnabled(cfg, door)).map((door) => {
    const name = doorTitle(cfg, door);
    const actions = doorActions(cfg, door);
    if (lang === "en") {
      if (actions.includes("unlock")) return `${name}: tap “Unlock ${name}”, then press the handle. When leaving, tap “Lock ${name}”.`;
      if (actions.includes("lock")) return `${name}: tap “Open ${name}”. When leaving, pull the door shut and tap “Lock ${name}”.`;
      if (doorBuzzes(cfg, door)) return `${name}: tap “Open ${name}”, then push the door.`;
      return `${name}: tap “Open ${name}”.`;
    }
    if (actions.includes("unlock")) return `${name}: auf „${name} aufsperren“ tippen und die Klinke drücken. Beim Gehen auf „${name} zusperren“ tippen.`;
    if (actions.includes("lock")) return `${name}: auf „${name} öffnen“ tippen. Beim Gehen zuziehen und auf „${name} zusperren“ tippen.`;
    if (doorBuzzes(cfg, door)) return `${name}: auf „${name} öffnen“ tippen und die Tür aufdrücken.`;
    return `${name}: auf „${name} öffnen“ tippen.`;
  });
  const intro = lang === "en" ? "Open the link and enter the PIN." : "Öffne den Link und gib den PIN ein.";
  const geo =
    cfg.geofenceRadiusM > 0
      ? lang === "en"
        ? " Please allow location access when your phone asks."
        : " Bitte erlaube den Standortzugriff, wenn dein Handy fragt."
      : "";
  return `${intro} ${lines.join(" ")}${geo}`;
}

export function guestMessageText(cfg: Config, stay: Stay, link: string, lang: Lang = "de"): string {
  const tz = cfg.timezone;
  const phone = cfg.hostPhone;
  if (lang === "en") {
    const fmt = (ts: number) => formatDateTime(ts, tz, "en-GB");
    return [
      `Hello ${stay.guest_name},`,
      ``,
      `here is your digital key for ${cfg.propertyName}:`,
      link,
      `PIN: ${stay.pin}`,
      ``,
      stay.role === "admin" ? `This access does not expire.` : `Valid from ${fmt(stay.valid_from)} until ${fmt(stay.valid_until)}.`,
      guestInstructions(cfg, "en"),
      ...(phone ? [``, `If anything goes wrong: ${phone}`] : []),
    ].join("\n");
  }
  const fmt = (ts: number) => formatDateTime(ts, tz, "de-DE");
  return [
    `Hallo ${stay.guest_name},`,
    ``,
    `hier ist dein digitaler Schlüssel für die ${cfg.propertyName}:`,
    link,
    `PIN: ${stay.pin}`,
    ``,
    stay.role === "admin" ? `Der Zugang ist unbegrenzt gültig.` : `Gültig von ${fmt(stay.valid_from)} bis ${fmt(stay.valid_until)}.`,
    guestInstructions(cfg, "de"),
    ...(phone ? [``, `Bei Problemen: ${phone}`] : []),
  ].join("\n");
}

function adminShell(cfg: Config, current: "access" | "log", title: string, body: string): string {
  const nav = (key: typeof current, href: string, label: string) =>
    `<a href="${href}"${key === current ? ` aria-current="page"` : ""}>${label}</a>`;
  return page({
    title: `${title} – ${cfg.propertyName}`,
    script: "admin",
    body: `<header class="topbar"><div class="topbar-inner">
  <a class="brand" href="/admin"><span aria-hidden="true">🏡</span>${esc(cfg.propertyName)}</a>
  <nav>${nav("access", "/admin", "Zugänge")}${nav("log", "/admin/log", "Protokoll")}</nav>
  <form method="post" action="/admin/logout"><button class="btn sm">Abmelden</button></form>
</div></header>
<main class="admin">
<h1 class="sr-only">${esc(title)}</h1>
${body}
</main>`,
  });
}

function postButton(action: string, label: string, opts: { cls?: string; confirm?: string } = {}): string {
  const confirm = opts.confirm ? ` data-confirm="${esc(opts.confirm)}"` : "";
  return `<form method="post" action="${esc(action)}"${confirm}><button class="${opts.cls ?? ""}">${label}</button></form>`;
}

function accessItem(cfg: Config, s: Stay, origin: string, now: number): string {
  const tz = cfg.timezone;
  const st = stayStatus(s, now);
  const locked = !!s.locked_until && s.locked_until > now;
  const link = `${origin}/g/${s.token}`;
  const base = `/admin/stays/${s.token}`;
  const period =
    s.role === "admin"
      ? "unbegrenzt gültig"
      : `${formatShort(s.valid_from, tz, "de-DE")} → ${formatShort(s.valid_until, tz, "de-DE")}`;
  const pin = `${s.pin.slice(0, 3)}\u202f${s.pin.slice(3)}`;
  return `<article class="access">
  <div>
    <div class="access-name">${esc(s.guest_name)}
      ${s.role === "guest" ? `<span class="badge ${st}">${statusLabel[st]}</span>` : st === "revoked" ? `<span class="badge revoked">widerrufen</span>` : ""}
      ${locked ? `<span class="badge locked">PIN gesperrt</span>` : ""}
    </div>
    <div class="access-period">${esc(period)}</div>
  </div>
  <div class="access-pin"><small>PIN</small><span class="pin">${esc(pin)}</span></div>
  <div class="access-actions">
    <button class="btn sm primary" type="button" data-copy="${esc(guestMessageText(cfg, s, link))}">Nachricht kopieren</button>
    <details class="more">
      <summary class="btn sm" aria-label="Weitere Aktionen">⋯</summary>
      <div class="menu">
        <button type="button" data-copy="${esc(guestMessageText(cfg, s, link, "en"))}">Nachricht auf Englisch kopieren</button>
        <button type="button" data-copy="${esc(link)}">Nur Link kopieren</button>
        <hr>
        ${locked ? postButton(`${base}/unlock`, "PIN-Sperre aufheben") : ""}
        ${postButton(`${base}/new-pin`, "Neuen PIN erzeugen", { confirm: "Neuen PIN erzeugen? Der alte PIN und bestehende Logins werden ungültig." })}
        ${s.revoked ? postButton(`${base}/restore`, "Reaktivieren") : postButton(`${base}/revoke`, "Widerrufen", { confirm: `Zugang von ${s.guest_name} widerrufen?` })}
        ${postButton(`${base}/delete`, "Löschen", { cls: "danger", confirm: `Zugang von ${s.guest_name} endgültig löschen?` })}
      </div>
    </details>
  </div>
</article>`;
}

function batteryBadge(status: BatteryStatus | null): string {
  if (!status) return `<span class="badge">kein Batterie-Sensor</span>`;
  if (!status.ok) return `<span class="badge bad" title="${esc(status.error)}">Batterie unbekannt</span>`;
  const value = status.percent === null ? (status.critical ? "schwach" : "ok") : `${status.percent}&nbsp;%`;
  return isLow(status) ? `<span class="badge bad">🪫 ${value}</span>` : `<span class="badge good">🔋 ${value}</span>`;
}

function deviceCard(cfg: Config, door: Door, battery: BatteryStatus | null): string {
  const entity = door === "house" ? cfg.doorHouse : cfg.doorApartment;
  const label = doorTitle(cfg, door);
  const error = battery && !battery.ok ? `<p class="small muted">${esc(battery.error)}</p>` : "";
  const tests = doorActions(cfg, door)
    .map((action) => {
      const text = action === "lock" ? "Zusperren" : action === "unlock" ? "Aufsperren" : "Öffnen";
      const confirm = action === "lock" ? undefined : `${label} jetzt wirklich ${text.toLowerCase()}?`;
      return postButton(`/admin/test/${door}/${action}`, text, { cls: "btn sm", confirm });
    })
    .join("");
  return `<div class="card">
  <div class="device-head">
    <div><h2>${door === "house" ? "🏠" : "🚪"} ${esc(label)}</h2><div class="entity">${esc(entity)}</div></div>
    ${batteryBadge(battery)}
  </div>
  ${error}
  <div class="row-actions">
    ${tests}
  </div>
</div>`;
}

export function adminPage(
  cfg: Config,
  guests: Stay[],
  admins: Stay[],
  batteries: Record<Door, BatteryStatus | null>,
  origin: string,
  flash?: string,
): string {
  const tz = cfg.timezone;
  const now = Date.now();
  const current = guests.filter((s) => s.valid_until > now).sort((a, b) => a.valid_from - b.valid_from);
  const past = guests.filter((s) => s.valid_until <= now);
  const item = (s: Stay) => accessItem(cfg, s, origin, now);
  const enabled = DOORS.filter((d) => doorEnabled(cfg, d));
  const lowDoors = enabled.filter((d) => {
    const status = batteries[d];
    return status && isLow(status);
  }).map((d) => doorTitle(cfg, d));

  const defaultFrom = epochToLocalInput(localTimeOnDay(0, 15, tz), tz);
  const defaultUntil = epochToLocalInput(localTimeOnDay(3, 11, tz), tz);

  return adminShell(
    cfg,
    "access",
    "Zugänge",
    `${flash ? `<p class="notice ok" role="status">${esc(flash)}</p>` : ""}
${lowDoors.length ? `<p class="notice err">🪫 Batterie schwach: ${esc(lowDoors.join(", "))}. Bitte vor der nächsten Anreise tauschen oder laden.</p>` : ""}
<section class="devices" aria-label="Geräte">
  ${enabled.map((door) => deviceCard(cfg, door, batteries[door])).join("\n  ")}
</section>

<form class="card" method="post" action="/admin/stays">
  <h2>Neuer Aufenthalt</h2>
  <div class="form-grid">
    <div><label for="guest_name">Gastname</label><input id="guest_name" name="guest_name" required maxlength="80" placeholder="z. B. Familie Huber"></div>
    <div><label for="valid_from">Anreise ab</label><input id="valid_from" type="datetime-local" name="valid_from" value="${defaultFrom}" required></div>
    <div><label for="valid_until">Abreise bis</label><input id="valid_until" type="datetime-local" name="valid_until" value="${defaultUntil}" required></div>
    <div><button class="btn primary" type="submit">Anlegen</button></div>
  </div>
</form>

<section class="card">
  <div class="section-head"><h2>Aufenthalte</h2><span class="muted small">${current.length} aktuell oder kommend</span></div>
  <div class="access-list">
    ${current.length ? current.map(item).join("") : `<p class="empty">Keine aktuellen oder kommenden Aufenthalte.</p>`}
  </div>
  ${
    past.length
      ? `<details class="past"><summary>Vergangene Aufenthalte (${past.length})</summary><div class="access-list">${past.map(item).join("")}</div></details>`
      : ""
  }
</section>

<section class="card">
  <h2>Admin-Nutzer</h2>
  <p class="muted small">Dauerhafter Zugang ohne Ablaufdatum, z.&nbsp;B. für euch selbst oder die Reinigungskraft. Die Standortprüfung gilt auch hier.</p>
  <form method="post" action="/admin/admins" class="form-grid two">
    <div><label for="admin_name">Name</label><input id="admin_name" name="name" required maxlength="80" placeholder="z. B. Reinigung"></div>
    <div><button class="btn" type="submit">Admin-Nutzer anlegen</button></div>
  </form>
  <div class="access-list">
    ${admins.length ? admins.map(item).join("") : `<p class="empty">Noch keine Admin-Nutzer.</p>`}
  </div>
</section>`,
  );
}

export function loginPage(cfg: Config, error?: string): string {
  return page({
    title: `Anmelden – ${cfg.propertyName}`,
    body: `<main class="login">
${brand(cfg)}
<h1>Verwaltung</h1>
<form class="card" method="post" action="/admin/login">
  <label for="password">Admin-Passwort</label>
  ${error ? `<p class="notice err" role="alert">${esc(error)}</p>` : ""}
  <input id="password" type="password" name="password" autocomplete="current-password" autofocus required>
  <p></p>
  <button class="btn primary block" type="submit">Anmelden</button>
</form>
</main>`,
  });
}

export function logPage(cfg: Config, entries: LogEntry[]): string {
  const tz = cfg.timezone;
  const rows = entries
    .map(
      (e) => `<tr>
  <td>${esc(formatDateTime(e.at, tz, "de-DE"))}</td>
  <td>${esc(e.guest_name ?? "Admin-Test")}</td>
  <td>${esc(doorTitle(cfg, e.door))}</td>
  <td>${actionLabel[e.action]}</td>
  <td>${e.success ? `<span class="badge good">ok</span>` : `<span class="badge bad">abgelehnt</span>`}</td>
  <td>${e.distance_m === null ? "–" : `${e.distance_m.toLocaleString("de-DE")} m`}</td>
  <td class="detail">${esc(e.detail)}</td>
</tr>`,
    )
    .join("");
  return adminShell(
    cfg,
    "log",
    "Protokoll",
    `<section class="card">
  <div class="section-head"><h2>Protokoll</h2><span class="muted small">letzte ${entries.length} Einträge</span></div>
  ${
    entries.length
      ? `<div class="table-wrap"><table><thead><tr><th>Zeit</th><th>Wer</th><th>Tür</th><th>Aktion</th><th>Ergebnis</th><th>Entfernung</th><th>Details</th></tr></thead><tbody>${rows}</tbody></table></div>`
      : `<p class="empty">Noch keine Einträge.</p>`
  }
</section>`,
  );
}
