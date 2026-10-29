import assert from "node:assert/strict";
import { test } from "node:test";
import { buildConfig } from "../src/config";
import { LoginThrottle } from "../src/throttle";
import { HOME, PASSWORD, setup } from "./helpers";

const nearby = { lat: HOME.lat + 0.0005, lon: HOME.lon, accuracy: 30 };

test("pages send a strict CSP and contain no inline code", async () => {
  const s = setup();
  const stay = s.addStay();
  await s.loginGuest(stay);
  await s.loginAdmin();
  for (const path of [`/g/${stay.token}`, "/admin", "/admin/log", "/admin/login"]) {
    const res = await s.request(path);
    assert.match(res.headers.get("content-security-policy")!, /script-src 'self'; style-src 'self'/, path);
    assert.equal(res.headers.get("x-frame-options"), "DENY");
    const html = await res.text();
    assert.doesNotMatch(html, /<script(?![^>]*\b(src=|type="application\/json"))/, `${path}: inline script`);
    assert.doesNotMatch(html, /\sstyle="|\son[a-z]+="/, `${path}: inline style or handler`);
  }
});

test("assets are served and cacheable, HSTS only over HTTPS", async () => {
  const s = setup();
  const css = await s.request("/assets/app.css");
  assert.equal(css.status, 200);
  assert.match(css.headers.get("content-type")!, /text\/css/);
  assert.match(css.headers.get("cache-control")!, /max-age/);
  assert.equal((await s.request("/assets/../store.ts")).status, 404);
  assert.equal(css.headers.get("strict-transport-security"), null);
  const https = await s.request("/healthz", { headers: { "x-forwarded-proto": "https" } });
  assert.match(https.headers.get("strict-transport-security")!, /max-age/);
  const spoofed = await s.request("/healthz", { headers: { "cf-visitor": '{"scheme":"https"}' } });
  assert.equal(spoofed.headers.get("strict-transport-security"), null);
});

test("oversized bodies are rejected", async () => {
  const s = setup();
  const res = await s.form("/admin/login", { password: "x".repeat(20_000) });
  assert.equal(res.status, 413);
});

test("admin login locks a client after 5 failures, others can still log in", async () => {
  const s = setup();
  const attacker = { "x-real-ip": "203.0.113.9", "cf-connecting-ip": "198.51.100.50" };
  for (let i = 0; i < 5; i++) assert.equal((await s.form("/admin/login", { password: "wrong" }, attacker)).status, 401);
  assert.equal((await s.form("/admin/login", { password: PASSWORD }, attacker)).status, 429);
  assert.match(s.notifications.at(-1)!.title, /Admin-Login gesperrt/);
  assert.equal(
    (await s.form("/admin/login", { password: PASSWORD }, { "x-real-ip": "203.0.113.9", "cf-connecting-ip": "203.0.113.1" })).status,
    429,
    "a spoofed CF-Connecting-IP does not start a new bucket",
  );
  assert.equal((await s.form("/admin/login", { password: PASSWORD }, { "x-real-ip": "198.51.100.7" })).status, 303);
});

test("login throttle also has a global limit", () => {
  const throttle = new LoginThrottle({ perClient: 5, global: 6, windowMs: 60_000, lockMs: 60_000 });
  for (let i = 0; i < 5; i++) assert.equal(throttle.fail(`ip${i}`, 1000), null);
  assert.equal(throttle.fail("ip-new", 1000), "global");
  assert.ok(throttle.lockedUntil("anyone", 2000));
  assert.equal(throttle.lockedUntil("anyone", 1000 + 60_001), null);
});

test("the language chosen via ?lang survives the PIN redirect", async () => {
  const s = setup();
  const stay = s.addStay();
  await s.request(`/g/${stay.token}?lang=de`, { headers: { "accept-language": "en" } });
  await s.form(`/g/${stay.token}/pin`, { pin: stay.pin });
  const html = await (await s.request(`/g/${stay.token}`, { headers: { "accept-language": "en" } })).text();
  assert.match(html, /lang="de"/);
});

test("host is notified about check-in, refused remote opening and locked PINs", async () => {
  const s = setup();
  const stay = s.addStay();
  await s.loginGuest(stay);
  await s.door(stay.token, { door: "house", lat: HOME.lat + 0.1, lon: HOME.lon, accuracy: 20 });
  assert.match(s.notifications.at(-1)!.message, /Erika Muster wollte „Haustür“ aus 11\.1 km/);
  await s.door(stay.token, { door: "house", ...nearby });
  assert.match(s.notifications.at(-1)!.title, /Gast angekommen/);
  const count = s.notifications.length;
  await s.door(stay.token, { door: "apartment", ...nearby });
  assert.equal(s.notifications.length, count, "only the first opening is announced");

  const other = s.addStay({ guest_name: "Max" });
  for (let i = 0; i < 5; i++) await s.form(`/g/${other.token}/pin`, { pin: "000000" });
  assert.match(s.notifications.at(-1)!.message, /Max wurde nach 5 falschen PINs/);
});

test("notify_service is normalised and validated", () => {
  const runtime = { dataDir: "", homeAssistant: { url: "", token: "" }, sessionSecret: "x" };
  const base = { admin_password: PASSWORD, geofence_radius_m: 0 };
  assert.equal(buildConfig({ ...base, notify_service: "mobile_app_phil" }, runtime).notifyService, "notify.mobile_app_phil");
  assert.equal(buildConfig({ ...base, notify_service: "notify.family" }, runtime).notifyService, "notify.family");
  assert.throws(() => buildConfig({ ...base, notify_service: "notify.My Phone" }, runtime), /notify_service/);
});
