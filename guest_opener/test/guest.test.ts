import assert from "node:assert/strict";
import { test } from "node:test";
import { HomeAssistant } from "../src/homeassistant";
import { texts } from "../src/i18n";
import type { Stay } from "../src/store";
import { guestMessageText } from "../src/views";
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

test("a disabled door is hidden and rejects actions", async () => {
  const s = setup(testConfig({ doorHouse: "off", doorApartmentName: "Hoftor", doorApartmentMode: "unlock_and_lock" }));
  const stay = s.addStay();
  await s.loginGuest(stay);
  const html = await (await s.request(`/g/${stay.token}`)).text();
  assert.doesNotMatch(html, /data-door="house"/);
  assert.match(html, /data-door="apartment" data-action="unlock"/);
  assert.match(html, /Unlock Hoftor/);
  assert.equal((await s.door(stay.token, { door: "house", ...nearby })).status, 400);
  assert.equal((await s.door(stay.token, { door: "apartment", action: "unlock" })).status, 403);
  assert.equal((await s.door(stay.token, { door: "apartment", action: "unlock", ...nearby })).status, 200);
  await s.loginAdmin();
  const admin = await (await s.request("/admin")).text();
  assert.match(admin, /Hoftor aufsperren/);
  assert.match(admin, /\/admin\/test\/apartment\/unlock/);
  assert.doesNotMatch(admin, /\/admin\/test\/house\//);
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

test("the door endpoint only accepts JSON, so a plain HTML form can't trigger it", async () => {
  const s = setup();
  const stay = s.addStay();
  await s.loginGuest(stay);
  const res = await s.request(`/g/${stay.token}/door`, {
    method: "POST",
    headers: { "content-type": "text/plain" },
    body: JSON.stringify({ door: "house", ...nearby }),
  });
  assert.equal(res.status, 415);
  assert.equal(s.store.recentLog(10).length, 0);
});

test("parallel taps trigger the door only once", async () => {
  const s = setup();
  const stay = s.addStay();
  await s.loginGuest(stay);
  const results = await Promise.all([1, 2, 3].map(() => s.door(stay.token, { door: "apartment", ...nearby })));
  assert.deepEqual(results.map((r) => r.status), [200, 200, 200]);
  assert.equal(s.store.recentLog(10).length, 1);
});

test("after a failed opening the guest can retry at once", async () => {
  let calls = 0;
  const fetchImpl = (async () => (++calls === 1 ? new Response("unavailable", { status: 503 }) : Response.json([]))) as typeof fetch;
  const s = setup(testConfig({ doorApartment: "lock.wohnung" }), new HomeAssistant("http://ha", "token", fetchImpl));
  const stay = s.addStay();
  await s.loginGuest(stay);
  assert.equal((await s.door(stay.token, { door: "apartment", ...nearby })).status, 502);
  assert.equal((await s.door(stay.token, { door: "apartment", ...nearby })).status, 200);
  assert.equal(calls, 2);
  assert.deepEqual(s.store.recentLog(10).map((e) => e.success), [true, false]);
});

test("the guest message names the property without an article", () => {
  const cfg = testConfig({ propertyName: "Haus Alpenblick" });
  const stay = { token: "t", role: "guest", guest_name: "Erika", pin: "123456", valid_from: 0, valid_until: 1 } as Stay;
  assert.match(guestMessageText(cfg, stay, "https://x/g/t"), /Schlüssel für „Haus Alpenblick“:/);
});

// Guests are addressed formally ("Sie"); the admin pages are for the hosts and may use "du".
const INFORMAL = /\b(du|dich|dir|dein\w*|gib|tippe|lade|erlaube|versuche|ruf)\b/i;

test("German guest texts address the guest as Sie", async () => {
  for (const [key, value] of Object.entries(texts.de)) {
    const text = typeof value === "function" ? (value as (arg: string) => string)("X") : value;
    assert.doesNotMatch(text, INFORMAL, key);
  }
  const cfg = testConfig({ hostPhone: "+49 170 0000000" });
  const stay = { token: "t", role: "guest", guest_name: "Erika", pin: "123456", valid_from: 0, valid_until: 1 } as Stay;
  const message = guestMessageText(cfg, stay, "https://x/g/t");
  assert.doesNotMatch(message, INFORMAL);
  assert.match(message, /hier ist Ihr digitaler Schlüssel/);
  assert.match(message, /Wir wünschen Ihnen einen schönen Aufenthalt!/);
  assert.doesNotMatch(guestMessageText(cfg, { ...stay, role: "admin" }, "https://x/g/t"), /schönen Aufenthalt/);

  const s = setup();
  const guest = s.addStay();
  const pinPage = await (await s.request(`/g/${guest.token}`, { headers: { "accept-language": "de" } })).text();
  assert.match(pinPage, /Bitte geben Sie Ihren 6-stelligen PIN ein/);
  await s.loginGuest(guest);
  const doorsPage = await (await s.request(`/g/${guest.token}`, { headers: { "accept-language": "de" } })).text();
  assert.doesNotMatch(doorsPage.replace(/<[^>]+>/g, " "), INFORMAL);
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
