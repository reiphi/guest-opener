import assert from "node:assert/strict";
import { test } from "node:test";
import { Doors } from "../src/doors";
import { HomeAssistant } from "../src/homeassistant";
import { testConfig } from "./helpers";

type Call = { method: string; url: string; auth: string | null; body: unknown };

/** Stands in for the Home Assistant REST API. */
function fakeHa(states: Record<string, string> = {}, failWith?: number) {
  const calls: Call[] = [];
  const fetchImpl = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    calls.push({
      method: init?.method ?? "GET",
      url,
      auth: new Headers(init?.headers).get("authorization"),
      body: init?.body ? JSON.parse(String(init.body)) : undefined,
    });
    if (failWith) return new Response("boom", { status: failWith });
    const state = url.match(/\/api\/states\/(.+)$/);
    if (state) {
      if (!(state[1] in states)) return new Response("Entity not found.", { status: 404 });
      return Response.json({ entity_id: state[1], state: states[state[1]], attributes: {} });
    }
    return Response.json([]);
  }) as typeof fetch;
  return { calls, ha: new HomeAssistant("http://supervisor/core", "secret-token", fetchImpl) };
}

function doorsFor(entities: { house: string; apartment: string; batteryHouse?: string; batteryApartment?: string }, ha: HomeAssistant) {
  return new Doors(
    testConfig({
      doorHouse: entities.house,
      doorApartment: entities.apartment,
      batteryHouse: entities.batteryHouse ?? "",
      batteryApartment: entities.batteryApartment ?? "",
    }),
    ha,
  );
}

test("lock entities unlatch on open and lock on lock", async () => {
  const { calls, ha } = fakeHa();
  const doors = doorsFor({ house: "lock.front_door", apartment: "lock.wohnungstuer" }, ha);
  assert.deepEqual(await doors.operate("apartment", "open"), { ok: true, detail: "lock.open lock.wohnungstuer" });
  await doors.operate("apartment", "lock");
  await doors.operate("house", "open");
  assert.deepEqual(
    calls.map((c) => [c.method, c.url, c.body]),
    [
      ["POST", "http://supervisor/core/api/services/lock/open", { entity_id: "lock.wohnungstuer" }],
      ["POST", "http://supervisor/core/api/services/lock/lock", { entity_id: "lock.wohnungstuer" }],
      ["POST", "http://supervisor/core/api/services/lock/open", { entity_id: "lock.front_door" }],
    ],
  );
  assert.equal(calls[0].auth, "Bearer secret-token");
});

test("unlock-only apartment doors unlock instead of unlatching", async () => {
  const { calls, ha } = fakeHa();
  const doors = new Doors(testConfig({ doorHouse: "lock.front_door", doorApartment: "lock.apartment_door", apartmentUnlockOnly: true }), ha);
  assert.equal(doors.unlocksOnly("apartment"), true);
  assert.equal(doors.unlocksOnly("house"), false);
  await doors.operate("apartment", "open");
  await doors.operate("house", "open");
  assert.deepEqual(
    calls.map((c) => c.url.replace("http://supervisor/core/api/services/", "")),
    ["lock/unlock", "lock/open"],
  );
});

test("switches, buttons and scripts are triggered for opening", async () => {
  const { calls, ha } = fakeHa();
  await doorsFor({ house: "switch.front_door", apartment: "mock" }, ha).operate("house", "open");
  await doorsFor({ house: "button.summer", apartment: "mock" }, ha).operate("house", "open");
  await doorsFor({ house: "script.haustuer_oeffnen", apartment: "mock" }, ha).operate("house", "open");
  assert.deepEqual(
    calls.map((c) => c.url.replace("http://supervisor/core/api/services/", "")),
    ["switch/turn_on", "button/press", "script/turn_on"],
  );
});

test("only a lock or mock on the apartment door can lock", async () => {
  const { calls, ha } = fakeHa();
  assert.equal(doorsFor({ house: "lock.opener", apartment: "lock.tuer" }, ha).canLock("house"), false);
  assert.equal(doorsFor({ house: "mock", apartment: "lock.tuer" }, ha).canLock("apartment"), true);
  assert.equal(doorsFor({ house: "mock", apartment: "mock" }, ha).canLock("apartment"), true);
  const switchDoor = doorsFor({ house: "mock", apartment: "switch.front_door" }, ha);
  assert.equal(switchDoor.canLock("apartment"), false);
  assert.equal((await switchDoor.operate("apartment", "lock")).ok, false);
  assert.equal(calls.length, 0);
});

test("unsupported domains and HA errors are reported, not thrown", async () => {
  const unsupported = await doorsFor({ house: "light.flur", apartment: "mock" }, fakeHa().ha).operate("house", "open");
  assert.equal(unsupported.ok, false);
  const failing = await doorsFor({ house: "switch.bot", apartment: "mock" }, fakeHa({}, 500).ha).operate("house", "open");
  assert.equal(failing.ok, false);
  assert.match(failing.detail, /HA 500/);
  const offline = await doorsFor({ house: "switch.bot", apartment: "mock" }, new HomeAssistant("", "")).operate("house", "open");
  assert.match(offline.detail, /not configured/);
});

test("battery levels come from sensor or binary_sensor entities", async () => {
  const { ha } = fakeHa({ "sensor.tuer_batterie": "42.4", "binary_sensor.bot_batterie": "on", "sensor.kaputt": "unavailable" });
  const doors = doorsFor(
    { house: "switch.bot", apartment: "lock.tuer", batteryHouse: "binary_sensor.bot_batterie", batteryApartment: "sensor.tuer_batterie" },
    ha,
  );
  assert.deepEqual(await doors.battery("apartment"), { ok: true, percent: 42, critical: false });
  assert.deepEqual(await doors.battery("house"), { ok: true, percent: null, critical: true });

  const broken = doorsFor({ house: "switch.bot", apartment: "lock.tuer", batteryApartment: "sensor.kaputt" }, ha);
  assert.equal((await broken.battery("apartment"))?.ok, false);
  assert.equal(await broken.battery("house"), null);
  const missing = doorsFor({ house: "switch.bot", apartment: "lock.tuer", batteryApartment: "sensor.gibtsnicht" }, ha);
  assert.equal((await missing.battery("apartment"))?.ok, false);
});
