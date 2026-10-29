import type { Config } from "./config";
import type { HomeAssistant } from "./homeassistant";

export const DOORS = ["house", "apartment"] as const;
export type Door = (typeof DOORS)[number];

/** open = one entry button. open_and_lock = unlatch and lock. unlock_and_lock = unlock and lock. */
export const DOOR_MODES = ["open", "open_and_lock", "unlock_and_lock"] as const;
export type DoorMode = (typeof DOOR_MODES)[number];

export type DoorAction = "open" | "unlock" | "lock";

export function isDoor(value: unknown): value is Door {
  return typeof value === "string" && (DOORS as readonly string[]).includes(value);
}

export function isDoorMode(value: string): value is DoorMode {
  return (DOOR_MODES as readonly string[]).includes(value);
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
 * Which Home Assistant service opens a door, by entity domain.
 * lock.open pulls the latch. A button pusher is a switch or button.
 */
const OPEN_SERVICE: Record<string, string> = {
  lock: "open",
  button: "press",
  switch: "turn_on",
  script: "turn_on",
};

export function doorEntity(cfg: Config, door: Door): string {
  return door === "house" ? cfg.doorHouse : cfg.doorApartment;
}

export function doorEnabled(cfg: Config, door: Door): boolean {
  return doorEntity(cfg, door) !== "off";
}

export function doorMode(cfg: Config, door: Door): DoorMode {
  return door === "house" ? cfg.doorHouseMode : cfg.doorApartmentMode;
}

export function doorTitle(cfg: Config, door: Door): string {
  return door === "house" ? cfg.doorHouseName : cfg.doorApartmentName;
}

/** switch, button, script, and a mock in "open" mode: the guest pushes the door after a buzzer. */
export function doorBuzzes(cfg: Config, door: Door): boolean {
  const entity = doorEntity(cfg, door);
  return doorMode(cfg, door) === "open" && !entity.startsWith("lock.");
}

export function doorActions(cfg: Config, door: Door): DoorAction[] {
  if (!doorEnabled(cfg, door)) return [];
  const entity = doorEntity(cfg, door);
  const lockable = entity === "mock" || entity.startsWith("lock.");
  switch (doorMode(cfg, door)) {
    case "unlock_and_lock":
      return lockable ? ["unlock", "lock"] : [];
    case "open_and_lock":
      return lockable ? ["open", "lock"] : ["open"];
    default:
      return ["open"];
  }
}

/** Opening and unlocking let someone in. Locking does not. */
export function isEntryAction(action: DoorAction): boolean {
  return action !== "lock";
}

export class Doors {
  constructor(
    private readonly cfg: Config,
    private readonly ha: HomeAssistant,
  ) {}

  entity(door: Door): string {
    return doorEntity(this.cfg, door);
  }

  enabled(door: Door): boolean {
    return doorEnabled(this.cfg, door);
  }

  title(door: Door): string {
    return doorTitle(this.cfg, door);
  }

  actions(door: Door): DoorAction[] {
    return doorActions(this.cfg, door);
  }

  allows(door: Door, action: DoorAction): boolean {
    return this.actions(door).includes(action);
  }

  buzzes(door: Door): boolean {
    return doorBuzzes(this.cfg, door);
  }

  canLock(door: Door): boolean {
    return this.allows(door, "lock");
  }

  private batteryEntity(door: Door): string {
    return door === "house" ? this.cfg.batteryHouse : this.cfg.batteryApartment;
  }

  async operate(door: Door, action: DoorAction): Promise<DoorResult> {
    const entity = this.entity(door);
    if (!this.allows(door, action)) return { ok: false, detail: `${entity} cannot ${action}` };
    if (entity === "mock") {
      await new Promise((r) => setTimeout(r, 300));
      return { ok: true, detail: `mock ${action}` };
    }
    const domain = entity.split(".")[0];
    const service = action === "lock" ? "lock" : action === "unlock" ? "unlock" : OPEN_SERVICE[domain];
    if (!service) return { ok: false, detail: `${entity}: unsupported entity type` };
    try {
      await this.ha.callService(domain, service, { entity_id: entity });
      return { ok: true, detail: `${domain}.${service} ${entity}` };
    } catch (err) {
      return { ok: false, detail: `${domain}.${service} ${entity}: ${err instanceof Error ? err.message : String(err)}` };
    }
  }

  async battery(door: Door): Promise<BatteryStatus | null> {
    if (!this.enabled(door)) return null;
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
