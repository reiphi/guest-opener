import { createApp } from "../src/app";
import { buildConfig } from "../src/config";
import type { Config } from "../src/config";
import { Doors } from "../src/doors";
import { HomeAssistant } from "../src/homeassistant";
import { PERMANENT_UNTIL, Store } from "../src/store";
import type { NewStay } from "../src/store";

export const HOME = { lat: 47.5, lon: 11.1 };
export const PASSWORD = "test-password-123";

export function testConfig(overrides: Partial<Config> = {}): Config {
  return {
    ...buildConfig(
      { admin_password: PASSWORD, property_lat: HOME.lat, property_lon: HOME.lon, geofence_radius_m: 250 },
      { dataDir: "", homeAssistant: { url: "", token: "" }, sessionSecret: "test-secret" },
    ),
    ...overrides,
  };
}

/** A tiny cookie-aware client around `app.request`. */
export function setup(cfg = testConfig()) {
  const store = new Store(":memory:");
  const notifications: { title: string; message: string }[] = [];
  const notifier = { send: (title: string, message: string) => void notifications.push({ title, message }) };
  const app = createApp(cfg, store, new Doors(cfg, new HomeAssistant("", "")), notifier);
  const jar = new Map<string, string>();
  const setCookies: string[] = [];

  async function request(path: string, init: RequestInit = {}) {
    const headers = new Headers(init.headers);
    if (jar.size) headers.set("cookie", [...jar].map(([k, v]) => `${k}=${v}`).join("; "));
    const res = await app.request(path, { ...init, headers });
    for (const cookie of res.headers.getSetCookie()) {
      setCookies.push(cookie);
      const [pair] = cookie.split(";");
      const [name, value] = pair.split("=");
      if (/max-age=0/i.test(cookie) || value === "") jar.delete(name);
      else jar.set(name, value);
    }
    return res;
  }

  const form = (path: string, data: Record<string, string>, headers: Record<string, string> = {}) =>
    request(path, { method: "POST", body: new URLSearchParams(data), headers });

  const door = (token: string, body: Record<string, unknown>) =>
    request(`/g/${token}/door`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });

  function addStay(partial: Partial<NewStay> = {}): NewStay {
    const stay: NewStay = {
      token: `tok${Math.random().toString(36).slice(2)}`,
      role: "guest",
      guest_name: "Erika Muster",
      pin: "123456",
      valid_from: Date.now() - 3_600_000,
      valid_until: Date.now() + 86_400_000,
      ...partial,
    };
    if (stay.role === "admin") stay.valid_until = PERMANENT_UNTIL;
    store.createStay(stay);
    return stay;
  }

  async function loginGuest(stay: NewStay) {
    const res = await form(`/g/${stay.token}/pin`, { pin: stay.pin });
    if (res.status !== 303) throw new Error(`guest login failed: ${res.status}`);
  }

  async function loginAdmin() {
    const res = await form("/admin/login", { password: PASSWORD });
    if (res.status !== 303) throw new Error(`admin login failed: ${res.status}`);
  }

  return { app, store, notifications, jar, setCookies, request, form, door, addStay, loginGuest, loginAdmin };
}
