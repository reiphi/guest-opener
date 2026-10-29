import assert from "node:assert/strict";
import { test } from "node:test";
import { buildConfig } from "../src/config";
import { PASSWORD, setup, testConfig } from "./helpers";

test("admin pages require a login", async () => {
  const s = setup();
  const res = await s.request("/admin");
  assert.equal(res.status, 303);
  assert.equal(res.headers.get("location"), "/admin/login");
  assert.equal((await s.form("/admin/stays", { guest_name: "X" })).status, 303);
  assert.equal(s.store.listStays("guest").length, 0);
});

test("wrong password is rejected, correct one logs in and logout works", async () => {
  const s = setup();
  assert.equal((await s.form("/admin/login", { password: "nope" })).status, 401);
  await s.loginAdmin();
  assert.match(s.setCookies.at(-1)!, /SameSite=Strict/);
  assert.equal((await s.request("/admin")).status, 200);
  await s.form("/admin/logout", {});
  assert.equal((await s.request("/admin")).status, 303);
});

test("cross-site POSTs are rejected", async () => {
  const s = setup();
  const res = await s.form("/admin/login", { password: PASSWORD }, { "sec-fetch-site": "cross-site" });
  assert.equal(res.status, 403);
});

test("creating stays and admin users", async () => {
  const s = setup();
  await s.loginAdmin();
  await s.form("/admin/stays", { guest_name: "Familie Huber", valid_from: "2030-07-01T15:00", valid_until: "2030-07-08T11:00" });
  const [stay] = s.store.listStays("guest");
  assert.equal(stay.guest_name, "Familie Huber");
  assert.equal(stay.valid_from, Date.UTC(2030, 6, 1, 13)); // 15:00 Berlin summer time
  assert.match(stay.pin, /^\d{6}$/);

  const bad = await s.form("/admin/stays", { guest_name: "X", valid_from: "2030-07-08T11:00", valid_until: "2030-07-01T15:00" });
  assert.match(decodeURIComponent(bad.headers.get("location")!), /Abreise muss nach/);

  await s.form("/admin/admins", { name: "Putzfee" });
  const [admin] = s.store.listStays("admin");
  assert.equal(admin.guest_name, "Putzfee");
  assert.equal(new Date(admin.valid_until).getUTCFullYear(), 9999);

  const html = await (await s.request("/admin")).text();
  assert.match(html, /Familie Huber/);
  assert.match(html, /unbegrenzt gültig/);
});

test("guest links use public_url when configured", async () => {
  const s = setup(testConfig({ publicUrl: "https://tuer.example.de" }));
  await s.loginAdmin();
  const stay = s.addStay();
  assert.match(await (await s.request("/admin")).text(), new RegExp(`https://tuer.example.de/g/${stay.token}`));
});

test("revoke, restore, new PIN, unlock and delete", async () => {
  const s = setup();
  await s.loginAdmin();
  const stay = s.addStay();
  await s.form(`/admin/stays/${stay.token}/revoke`, {});
  assert.equal(s.store.getStay(stay.token)!.revoked, true);
  await s.form(`/admin/stays/${stay.token}/restore`, {});
  assert.equal(s.store.getStay(stay.token)!.revoked, false);
  await s.form(`/admin/stays/${stay.token}/new-pin`, {});
  assert.notEqual(s.store.getStay(stay.token)!.pin, stay.pin);
  s.store.recordFailedAttempt(stay.token, 1, 60_000);
  assert.match(await (await s.request("/admin")).text(), /PIN gesperrt/);
  await s.form(`/admin/stays/${stay.token}/unlock`, {});
  assert.equal(s.store.getStay(stay.token)!.locked_until, null);
  await s.form(`/admin/stays/${stay.token}/delete`, {});
  assert.equal(s.store.getStay(stay.token), null);
});

test("device section shows batteries and test buttons log as admin test", async () => {
  const s = setup();
  await s.loginAdmin();
  const html = await (await s.request("/admin")).text();
  assert.match(html, /Batterie schwach: Haustür/);
  assert.match(html, /87&nbsp;%/);
  assert.match(html, /\/admin\/test\/apartment\/lock/);

  await s.form("/admin/test/apartment/lock", {});
  const [entry] = s.store.recentLog(1);
  assert.equal(entry.action, "lock");
  assert.equal(entry.guest_name, null);
  assert.match(await (await s.request("/admin/log")).text(), /Admin-Test/);
});

test("invalid configuration fails loudly", () => {
  const runtime = { dataDir: "", homeAssistant: { url: "", token: "" }, sessionSecret: "x" };
  assert.throws(() => buildConfig({ admin_password: "kurz", property_lat: 1, property_lon: 1 }, runtime), /admin_password/);
  assert.throws(() => buildConfig({ admin_password: PASSWORD }, runtime), /property_lat/);
  assert.throws(
    () => buildConfig({ admin_password: PASSWORD, geofence_radius_m: 0, door_house: "keine Entität" }, runtime),
    /door_house/,
  );
  assert.doesNotThrow(() => buildConfig({ admin_password: PASSWORD, geofence_radius_m: 0 }, runtime));
  assert.throws(
    () => buildConfig({ admin_password: PASSWORD, geofence_radius_m: 0, door_house: "off", door_apartment: "off" }, runtime),
    /at least one/,
  );
  assert.throws(
    () =>
      buildConfig(
        { admin_password: PASSWORD, geofence_radius_m: 0, door_house: "switch.front_door", door_house_mode: "open_and_lock" },
        runtime,
      ),
    /door_house_mode/,
  );
  const legacy = buildConfig({ admin_password: PASSWORD, geofence_radius_m: 0, door_apartment_unlock_only: true }, runtime);
  assert.equal(legacy.doorApartmentMode, "unlock_and_lock");
  assert.equal(legacy.doorHouseMode, "open");
  const chosen = buildConfig(
    { admin_password: PASSWORD, geofence_radius_m: 0, door_apartment_unlock_only: true, door_apartment_mode: "open" },
    runtime,
  );
  assert.equal(chosen.doorApartmentMode, "open");
  const named = buildConfig({ admin_password: PASSWORD, geofence_radius_m: 0, door_house: "off", door_apartment_name: "Hoftor" }, runtime);
  assert.equal(named.doorHouse, "off");
  assert.equal(named.doorApartmentName, "Hoftor");
});
