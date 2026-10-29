import { serve } from "@hono/node-server";
import { join } from "node:path";
import { createApp } from "./app";
import { loadConfig } from "./config";
import { Doors } from "./doors";
import { HomeAssistant } from "./homeassistant";
import { Notifier } from "./notify";
import { Store } from "./store";

const PORT = Number(process.env.PORT || 8787);

const cfg = loadConfig();
const store = new Store(join(cfg.dataDir, "guest-opener.db"));
const ha = new HomeAssistant(cfg.homeAssistant.url, cfg.homeAssistant.token);
const doors = new Doors(cfg, ha);
const notifier = new Notifier(ha, cfg.notifyService);

for (const door of ["house", "apartment"] as const) {
  const entity = doors.entity(door);
  if (entity !== "mock" && !ha.configured) {
    console.error(`door_${door} is ${entity}, but no Home Assistant connection is configured (HA_URL / HA_TOKEN)`);
  }
}

const server = serve({ fetch: createApp(cfg, store, doors, notifier).fetch, port: PORT, hostname: "0.0.0.0" }, () => {
  console.log(`Guest Opener listening on port ${PORT}`);
  for (const door of ["house", "apartment"] as const) {
    if (!doors.enabled(door)) continue;
    console.log(`  ${doors.title(door)}: ${doors.entity(door)} (${cfg[door === "house" ? "doorHouseMode" : "doorApartmentMode"]})`);
  }
  console.log(`  Benachrichtigungen: ${notifier.enabled ? cfg.notifyService : "aus"}`);
  if (cfg.geofenceRadiusM === 0) console.warn("  Standortprüfung ist AUS (geofence_radius_m = 0)");
});

function shutdown() {
  server.close();
  store.close();
  process.exit(0);
}
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
