import type { Config } from "./config";
import type { HomeAssistant } from "./homeassistant";

export const DOORS = ["house", "apartment"] as const;
export type Door = (typeof DOORS)[number];
export type DoorAction = "open" | "lock";

export function isDoor(value: unknown): value is Door {
  return typeof value === "string" && (DOORS as readonly string[]).includes(value);
}

export type DoorResult = { ok: boolean; detail: string };

export type BatteryStatus =
  | { ok: true; percent: number | null; critical: boolean }
  | { ok: false; error: string };

export const LOW_BATTERY_PERCENT = 20;

export function isLow(status: BatteryStatus): boolean {
  return status.ok && (status.critical || (status.percent !== null && status.percent <= LOW_BATTERY_PERCENT));
}

/**
 * Which Home Assistant service opens a door, by entity domain:
 * lock.open unlatches a smart lock or buzzes an intercom opener; a button pusher is a switch or button.
 */
const OPEN_SERVICE: Record<string, string> = {
  lock: "open",
  button: "press",
  switch: "turn_on",
  script: "turn_on",
};

export class Doors {
  constructor(
    private readonly cfg: Config,
    private readonly ha: HomeAssistant,
  ) {}

  entity(door: Door): string {
    return door === "house" ? this.cfg.doorHouse : this.cfg.doorApartment;
  }

  private batteryEntity(door: Door): string {
    return door === "house" ? this.cfg.batteryHouse : this.cfg.batteryApartment;
  }

  /** Only a real lock on the apartment door can lock; a buzzer or button pusher can only open. */
  canLock(door: Door): boolean {
    const entity = this.entity(door);
    return door === "apartment" && (entity === "mock" || entity.startsWith("lock."));
  }

  /** With a handle on the outside, unlocking is enough to get in; pulling the latch is not needed. */
  unlocksOnly(door: Door): boolean {
    return door === "apartment" && this.cfg.apartmentUnlockOnly && this.entity(door).startsWith("lock.");
  }

  async operate(door: Door, action: DoorAction): Promise<DoorResult> {
    const entity = this.entity(door);
    if (action === "lock" && !this.canLock(door)) return { ok: false, detail: `${entity} cannot lock` };
    if (entity === "mock") {
      await new Promise((r) => setTimeout(r, 300));
      return { ok: true, detail: `mock ${action}` };
    }
    const domain = entity.split(".")[0];
    const service = action === "lock" ? "lock" : this.unlocksOnly(door) ? "unlock" : OPEN_SERVICE[domain];
    if (!service) return { ok: false, detail: `${entity}: unsupported entity type` };
    try {
      await this.ha.callService(domain, service, { entity_id: entity });
      return { ok: true, detail: `${domain}.${service} ${entity}` };
    } catch (err) {
      return { ok: false, detail: `${domain}.${service} ${entity}: ${err instanceof Error ? err.message : String(err)}` };
    }
  }

  async battery(door: Door): Promise<BatteryStatus | null> {
    const entity = this.batteryEntity(door);
    if (!entity) return this.entity(door) === "mock" ? { ok: true, percent: door === "house" ? 15 : 87, critical: false } : null;
    try {
      const { state } = await this.ha.getState(entity);
      if (entity.startsWith("binary_sensor.")) return { ok: true, percent: null, critical: state === "on" };
      const percent = Number(state);
      if (!isFinite(percent)) return { ok: false, error: `${entity} meldet "${state}"` };
      return { ok: true, percent: Math.round(percent), critical: false };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  }
}
