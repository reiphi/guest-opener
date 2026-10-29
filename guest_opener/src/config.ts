import { randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { isDoorMode } from "./doors";
import type { DoorMode } from "./doors";

export type Config = {
  propertyName: string;
  /** Base URL used in guest links, e.g. https://tuer.example.de. Empty = derive from the request. */
  publicUrl: string;
  timezone: string;
  propertyLat: number;
  propertyLon: number;
  /** 0 disables the location check. */
  geofenceRadiusM: number;
  hostPhone: string;
  adminPassword: string;
  sessionSecret: string;
  /** "off" hides the door, "mock" simulates it, otherwise a Home Assistant entity id. */
  doorHouse: string;
  doorApartment: string;
  doorHouseName: string;
  doorApartmentName: string;
  doorHouseMode: DoorMode;
  doorApartmentMode: DoorMode;
  /** Optional sensor.* (percent) or binary_sensor.* (on = low) entity reporting the door device's battery. */
  batteryHouse: string;
  batteryApartment: string;
  /** Optional notify.* service for alerts such as check-in, locked PINs or failing doors. */
  notifyService: string;
  homeAssistant: { url: string; token: string };
  dataDir: string;
};

const ADDON_OPTIONS = "/data/options.json";

/** Add-on option names as defined in config.yaml; local development uses the upper-case env var equivalents. */
type Options = {
  property_name?: string;
  public_url?: string;
  timezone?: string;
  property_lat?: number;
  property_lon?: number;
  geofence_radius_m?: number;
  host_phone?: string;
  admin_password?: string;
  door_house?: string;
  door_house_name?: string;
  door_house_mode?: string;
  door_house_battery?: string;
  door_apartment?: string;
  door_apartment_name?: string;
  door_apartment_mode?: string;
  door_apartment_battery?: string;
  /** Previous option. Used only when door_apartment_mode is absent. */
  door_apartment_unlock_only?: boolean;
  notify_service?: string;
};

export const MIN_PASSWORD_LENGTH = 12;

function optionsFromEnv(env: NodeJS.ProcessEnv): Options {
  const num = (v: string | undefined) => (v === undefined || v === "" ? undefined : Number(v));
  return {
    property_name: env.PROPERTY_NAME,
    public_url: env.PUBLIC_URL,
    timezone: env.TIMEZONE,
    property_lat: num(env.PROPERTY_LAT),
    property_lon: num(env.PROPERTY_LON),
    geofence_radius_m: num(env.GEOFENCE_RADIUS_M),
    host_phone: env.HOST_PHONE,
    admin_password: env.ADMIN_PASSWORD,
    door_house: env.DOOR_HOUSE,
    door_house_name: env.DOOR_HOUSE_NAME,
    door_house_mode: env.DOOR_HOUSE_MODE,
    door_house_battery: env.DOOR_HOUSE_BATTERY,
    door_apartment: env.DOOR_APARTMENT,
    door_apartment_name: env.DOOR_APARTMENT_NAME,
    door_apartment_mode: env.DOOR_APARTMENT_MODE,
    door_apartment_battery: env.DOOR_APARTMENT_BATTERY,
    door_apartment_unlock_only: env.DOOR_APARTMENT_UNLOCK_ONLY === "true",
    notify_service: env.NOTIFY_SERVICE,
  };
}

/** The session secret signs login cookies; it is generated once and kept in the data directory (and thus in HA backups). */
function loadSessionSecret(dataDir: string): string {
  const file = join(dataDir, "session_secret");
  if (existsSync(file)) return readFileSync(file, "utf8").trim();
  const secret = randomBytes(32).toString("hex");
  mkdirSync(dataDir, { recursive: true });
  writeFileSync(file, secret, { mode: 0o600 });
  return secret;
}

export function buildConfig(
  o: Options,
  runtime: { homeAssistant: Config["homeAssistant"]; dataDir: string; sessionSecret: string },
): Config {
  const errors: string[] = [];
  if (!o.admin_password || o.admin_password.length < MIN_PASSWORD_LENGTH) {
    errors.push(`admin_password must have at least ${MIN_PASSWORD_LENGTH} characters`);
  }
  const lat = Number(o.property_lat);
  const lon = Number(o.property_lon);
  const radius = Number(o.geofence_radius_m ?? 250);
  if (radius > 0 && (!isFinite(lat) || !isFinite(lon) || (lat === 0 && lon === 0))) {
    errors.push("property_lat/property_lon must be set (or geofence_radius_m = 0)");
  }
  // Missing means the demo default. An explicit empty value turns the door off.
  const entity = (value: string | undefined) => {
    if (value === undefined) return "mock";
    const trimmed = value.trim();
    return trimmed === "" || trimmed === "off" ? "off" : trimmed;
  };
  const doorHouse = entity(o.door_house);
  const doorApartment = entity(o.door_apartment);
  const batteries = {
    door_house_battery: o.door_house_battery || "",
    door_apartment_battery: o.door_apartment_battery || "",
  };
  for (const [key, value] of Object.entries({ door_house: doorHouse, door_apartment: doorApartment, ...batteries })) {
    if (value !== "off" && value !== "mock" && value !== "" && !/^[a-z_]+\.[a-z0-9_]+$/.test(value)) {
      errors.push(`${key} must be "off", "mock" or a Home Assistant entity id like lock.front_door (got "${value}")`);
    }
  }
  const mode = (key: string, value: string | undefined, fallback: DoorMode): DoorMode => {
    if (value === undefined || value === "") return fallback;
    if (isDoorMode(value)) return value;
    errors.push(`${key} must be open, open_and_lock or unlock_and_lock (got "${value}")`);
    return fallback;
  };
  const doorHouseMode = mode("door_house_mode", o.door_house_mode, "open");
  const apartmentFallback: DoorMode = o.door_apartment_unlock_only === true ? "unlock_and_lock" : "open_and_lock";
  const doorApartmentMode = mode("door_apartment_mode", o.door_apartment_mode, apartmentFallback);
  const checkMode = (key: string, target: string, selected: DoorMode) => {
    if (target === "off" || target === "mock" || target.startsWith("lock.")) return;
    if (selected !== "open") errors.push(`${key} ${selected} needs a lock.* entity or mock (got "${target}")`);
  };
  checkMode("door_house_mode", doorHouse, doorHouseMode);
  checkMode("door_apartment_mode", doorApartment, doorApartmentMode);
  if (doorHouse === "off" && doorApartment === "off") {
    errors.push("at least one of door_house and door_apartment must be enabled");
  }
  const label = (value: string | undefined, fallback: string) => {
    const name = (value ?? "").trim().slice(0, 40);
    return name || fallback;
  };
  const notify = o.notify_service ? (o.notify_service.startsWith("notify.") ? o.notify_service : `notify.${o.notify_service}`) : "";
  if (notify && !/^notify\.[a-z0-9_]+$/.test(notify)) {
    errors.push(`notify_service must look like notify.mobile_app_my_phone (got "${o.notify_service}")`);
  }
  if (errors.length) throw new Error(`Invalid configuration:\n- ${errors.join("\n- ")}`);

  return {
    propertyName: o.property_name || "Ferienwohnung",
    publicUrl: (o.public_url || "").replace(/\/+$/, ""),
    timezone: o.timezone || "Europe/Berlin",
    propertyLat: lat,
    propertyLon: lon,
    geofenceRadiusM: radius,
    hostPhone: o.host_phone || "",
    adminPassword: o.admin_password!,
    sessionSecret: runtime.sessionSecret,
    doorHouse,
    doorApartment,
    doorHouseName: label(o.door_house_name, "Haustür"),
    doorApartmentName: label(o.door_apartment_name, "Wohnungstür"),
    doorHouseMode,
    doorApartmentMode,
    batteryHouse: batteries.door_house_battery,
    batteryApartment: batteries.door_apartment_battery,
    notifyService: notify,
    homeAssistant: runtime.homeAssistant,
    dataDir: runtime.dataDir,
  };
}

/** Inside Home Assistant the add-on options and Supervisor token are used; otherwise environment variables (see .env.example). */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  if (existsSync(ADDON_OPTIONS)) {
    const dataDir = "/data";
    return buildConfig(JSON.parse(readFileSync(ADDON_OPTIONS, "utf8")), {
      dataDir,
      homeAssistant: { url: "http://supervisor/core", token: env.SUPERVISOR_TOKEN ?? "" },
      sessionSecret: loadSessionSecret(dataDir),
    });
  }
  const dataDir = env.DATA_DIR || ".data";
  return buildConfig(optionsFromEnv(env), {
    dataDir,
    homeAssistant: { url: (env.HA_URL || "").replace(/\/+$/, ""), token: env.HA_TOKEN ?? "" },
    sessionSecret: env.SESSION_SECRET || loadSessionSecret(dataDir),
  });
}
