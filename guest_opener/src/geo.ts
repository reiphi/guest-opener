import type { Config } from "./config";

const MAX_ACCURACY_M = 1000;
const ACCURACY_ALLOWANCE_M = 200;

export type LocationResult =
  | { ok: true; distance: number | null }
  | { ok: false; reason: "missing" | "inaccurate" | "too_far"; distance?: number };

export function distanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6_371_000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

export function geofenceEnabled(cfg: Config): boolean {
  return cfg.geofenceRadiusM > 0;
}

export function checkLocation(cfg: Config, lat: unknown, lon: unknown, accuracy: unknown): LocationResult {
  if (!geofenceEnabled(cfg)) return { ok: true, distance: null };
  if (typeof lat !== "number" || typeof lon !== "number" || !isFinite(lat) || !isFinite(lon)) {
    return { ok: false, reason: "missing" };
  }
  const acc = typeof accuracy === "number" && isFinite(accuracy) ? accuracy : MAX_ACCURACY_M;
  const distance = Math.round(distanceMeters(lat, lon, cfg.propertyLat, cfg.propertyLon));
  // GPS indoors or in narrow streets is often off by 50-200 m, so the reported accuracy is granted as slack.
  if (distance - Math.min(acc, ACCURACY_ALLOWANCE_M) <= cfg.geofenceRadiusM) {
    return { ok: true, distance };
  }
  if (acc > MAX_ACCURACY_M) return { ok: false, reason: "inaccurate", distance };
  return { ok: false, reason: "too_far", distance };
}
