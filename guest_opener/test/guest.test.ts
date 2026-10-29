import assert from "node:assert/strict";
import { test } from "node:test";
import { HOME, setup, testConfig } from "./helpers";

const nearby = { lat: HOME.lat + 0.0005, lon: HOME.lon, accuracy: 30 };

test("unknown, upcoming, expired and revoked links explain themselves", async () => {
  const s = setup();
  assert.equal((await s.request("/g/nope")).status, 404);
  const upcoming = s.addStay({ valid_from: Date.now() + 86_400_000, valid_until: Date.now() + 2 * 86_400_000 });
  const res = await s.request(`/g/${upcoming.token}`);
  assert.equal(res.status, 200);
  assert.match(await res.text(), /access starts on/);
  const expired = s.addStay({ valid_from: Date.now() - 2 * 86_400_000, valid_until: Date.now() - 1000 });
  assert.equal((await s.request(`/g/${expired.token}`)).status, 410);
  const revoked = s.addStay();
  s.store.setRevoked(revoked.token, true);
  assert.equal((await s.request(`/g/${revoked.token}`)).status, 403);
});

test("correct PIN shows the door buttons including lock", async () => {
  const s = setup();
  const stay = s.addStay();
  assert.match(await (await s.request(`/g/${stay.token}`)).text(), /name="pin"/);
  await s.loginGuest(stay);
  const html = await (await s.request(`/g/${stay.token}`)).text();
  assert.match(html, /data-door="house" data-action="open"/);
  assert.match(html, /data-door="apartment" data-action="lock"/);
});

test("door actions require a session", async () => {
  const s = setup();
  const stay = s.addStay();
  assert.equal((await s.door(stay.token, { door: "house", ...nearby })).status, 401);
});

test("opening checks the location", async () => {
  const s = setup();
  const stay = s.addStay();
  await s.loginGuest(stay);
  assert.equal((await s.door(stay.token, { door: "house" })).status, 403);
  const far = await s.door(stay.token, { door: "house", lat: HOME.lat + 0.05, lon: HOME.lon, accuracy: 20 });
  assert.equal(far.status, 403);
  const vague = await s.door(stay.token, { door: "house", lat: HOME.lat + 0.01, lon: HOME.lon, accuracy: 5000 });
  assert.equal(vague.status, 403);
  assert.match((await vague.json()).message, /accura/i);
  const ok = await s.door(stay.token, { door: "house", ...nearby });
  assert.equal(ok.status, 200);
  assert.equal((await ok.json()).ok, true);
});

test("geofence radius 0 disables the location check", async () => {
  const s = setup(testConfig({ geofenceRadiusM: 0 }));
  const stay = s.addStay();
  await s.loginGuest(stay);
  assert.equal((await s.door(stay.token, { door: "apartment" })).status, 200);
});

test("locking skips the location check, the house door cannot lock", async () => {
  const s = setup();
  const stay = s.addStay();
  await s.loginGuest(stay);
  assert.equal((await s.door(stay.token, { door: "apartment", action: "lock" })).status, 200);
  assert.equal((await s.door(stay.token, { door: "house", action: "lock" })).status, 400);
  const [entry] = s.store.recentLog(1);
  assert.equal(entry.action, "lock");
  assert.equal(entry.guest_name, "Erika Muster");
});

test("double taps within the cooldown trigger the door only once", async () => {
  const s = setup();
  const stay = s.addStay();
  await s.loginGuest(stay);
  assert.equal((await s.door(stay.token, { door: "apartment", ...nearby })).status, 200);
  assert.equal((await s.door(stay.token, { door: "apartment", ...nearby })).status, 200);
  assert.equal(s.store.recentLog(10).filter((e) => e.success).length, 1);
});

test("a new PIN invalidates existing sessions", async () => {
  const s = setup();
  const stay = s.addStay();
  await s.loginGuest(stay);
  s.store.setPin(stay.token, "654321");
  assert.match(await (await s.request(`/g/${stay.token}`)).text(), /name="pin"/);
  assert.equal((await s.door(stay.token, { door: "house", ...nearby })).status, 401);
});

test("five wrong PINs lock the link", async () => {
  const s = setup();
  const stay = s.addStay();
  for (let i = 0; i < 5; i++) assert.equal((await s.form(`/g/${stay.token}/pin`, { pin: "000000" })).status, 401);
  assert.equal((await s.form(`/g/${stay.token}/pin`, { pin: stay.pin })).status, 429);
  s.store.resetAttempts(stay.token);
  assert.equal((await s.form(`/g/${stay.token}/pin`, { pin: stay.pin })).status, 303);
});

test("admin users get a long-lived session and are shown as permanent", async () => {
  const s = setup();
  const admin = s.addStay({ role: "admin", guest_name: "Putzfee" });
  await s.loginGuest(admin);
  const cookie = s.setCookies.find((c) => c.startsWith("go_session="))!;
  assert.match(cookie, /Max-Age=34560000/);
  assert.match(await (await s.request(`/g/${admin.token}`)).text(), /No expiry/);
});

test("session cookies are Secure behind an HTTPS proxy", async () => {
  const s = setup();
  const stay = s.addStay();
  await s.form(`/g/${stay.token}/pin`, { pin: stay.pin }, { "x-forwarded-proto": "https" });
  assert.match(s.setCookies.at(-1)!, /Secure/);
  await s.form(`/g/${stay.token}/pin`, { pin: stay.pin });
  assert.doesNotMatch(s.setCookies.at(-1)!, /Secure/);
});

test("English is served on request", async () => {
  const s = setup();
  const stay = s.addStay();
  const html = await (await s.request(`/g/${stay.token}?lang=en`)).text();
  assert.match(html, /lang="en"/);
});
