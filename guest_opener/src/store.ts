import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";
import type { Door, DoorAction } from "./doors";

export type Role = "guest" | "admin";

/** Admin users never expire; 9999-12-31 keeps `valid_until` a plain number and comparisons trivial. */
export const PERMANENT_UNTIL = Date.UTC(9999, 11, 31, 23, 59, 59);

const LOG_RETENTION_MS = 365 * 86_400_000;

export type Stay = {
  token: string;
  role: Role;
  guest_name: string;
  pin: string;
  valid_from: number;
  valid_until: number;
  revoked: boolean;
  failed_attempts: number;
  locked_until: number | null;
  created_at: number;
  last_open: Partial<Record<Door, number>>;
};

export type NewStay = Pick<Stay, "token" | "role" | "guest_name" | "pin" | "valid_from" | "valid_until">;

export type LogEntry = {
  at: number;
  door: Door;
  action: DoorAction;
  success: boolean;
  detail: string;
  distance_m: number | null;
  /** null for admin door tests */
  guest_name: string | null;
};

export type StayStatus = "active" | "upcoming" | "expired" | "revoked";

export function stayStatus(stay: Stay, now = Date.now()): StayStatus {
  if (stay.revoked) return "revoked";
  if (now < stay.valid_from) return "upcoming";
  if (now >= stay.valid_until) return "expired";
  return "active";
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS stays (
  token TEXT PRIMARY KEY,
  role TEXT NOT NULL CHECK (role IN ('guest', 'admin')),
  guest_name TEXT NOT NULL,
  pin TEXT NOT NULL,
  valid_from INTEGER NOT NULL,
  valid_until INTEGER NOT NULL,
  revoked INTEGER NOT NULL DEFAULT 0,
  failed_attempts INTEGER NOT NULL DEFAULT 0,
  locked_until INTEGER,
  created_at INTEGER NOT NULL,
  last_open_house INTEGER,
  last_open_apartment INTEGER
);
CREATE INDEX IF NOT EXISTS stays_role ON stays (role, valid_from);
CREATE TABLE IF NOT EXISTS access_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  at INTEGER NOT NULL,
  door TEXT NOT NULL,
  action TEXT NOT NULL,
  success INTEGER NOT NULL,
  detail TEXT,
  distance_m INTEGER,
  guest_name TEXT
);
CREATE INDEX IF NOT EXISTS access_log_at ON access_log (at);
`;

type StayRow = Omit<Stay, "revoked" | "last_open"> & {
  revoked: number;
  last_open_house: number | null;
  last_open_apartment: number | null;
};

function toStay(row: StayRow): Stay {
  const { last_open_house, last_open_apartment, revoked, ...rest } = row;
  const last_open: Stay["last_open"] = {};
  if (last_open_house) last_open.house = last_open_house;
  if (last_open_apartment) last_open.apartment = last_open_apartment;
  return { ...rest, revoked: !!revoked, last_open };
}

/** SQLite storage; the file lives in the add-on's /data directory and is therefore part of Home Assistant backups. */
export class Store {
  private readonly db: DatabaseSync;

  constructor(path: string) {
    if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
    this.db = new DatabaseSync(path);
    this.db.exec("PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;");
    this.db.exec(SCHEMA);
  }

  close() {
    this.db.close();
  }

  getStay(token: string): Stay | null {
    const row = this.db.prepare("SELECT * FROM stays WHERE token = ?").get(token) as StayRow | undefined;
    return row ? toStay(row) : null;
  }

  listStays(role: Role): Stay[] {
    const rows = this.db
      .prepare("SELECT * FROM stays WHERE role = ? ORDER BY valid_from DESC LIMIT 200")
      .all(role) as StayRow[];
    return rows.map(toStay);
  }

  createStay(s: NewStay) {
    this.db
      .prepare(
        `INSERT INTO stays (token, role, guest_name, pin, valid_from, valid_until, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(s.token, s.role, s.guest_name, s.pin, s.valid_from, s.valid_until, Date.now());
  }

  setRevoked(token: string, revoked: boolean) {
    this.db.prepare("UPDATE stays SET revoked = ? WHERE token = ?").run(revoked ? 1 : 0, token);
  }

  deleteStay(token: string) {
    this.db.prepare("DELETE FROM stays WHERE token = ?").run(token);
  }

  /** Also clears failed attempts and any PIN lock. */
  setPin(token: string, pin: string) {
    this.db.prepare("UPDATE stays SET pin = ?, failed_attempts = 0, locked_until = NULL WHERE token = ?").run(pin, token);
  }

  resetAttempts(token: string) {
    this.db.prepare("UPDATE stays SET failed_attempts = 0, locked_until = NULL WHERE token = ?").run(token);
  }

  /** Increments the counter; once it reaches `maxAttempts` the stay is locked and the counter restarts. */
  recordFailedAttempt(token: string, maxAttempts: number, lockMs: number) {
    const row = this.db
      .prepare("UPDATE stays SET failed_attempts = failed_attempts + 1 WHERE token = ? RETURNING failed_attempts")
      .get(token) as { failed_attempts: number } | undefined;
    const attempts = row?.failed_attempts ?? 0;
    if (attempts < maxAttempts) return { attempts, lockedUntil: null };
    const lockedUntil = Date.now() + lockMs;
    this.db.prepare("UPDATE stays SET failed_attempts = 0, locked_until = ? WHERE token = ?").run(lockedUntil, token);
    return { attempts, lockedUntil };
  }

  markOpened(token: string, door: Door, at: number) {
    const column = door === "house" ? "last_open_house" : "last_open_apartment";
    this.db.prepare(`UPDATE stays SET ${column} = ? WHERE token = ?`).run(at, token);
  }

  logAccess(e: LogEntry) {
    this.db
      .prepare(
        `INSERT INTO access_log (at, door, action, success, detail, distance_m, guest_name)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(e.at, e.door, e.action, e.success ? 1 : 0, e.detail, e.distance_m, e.guest_name);
    this.db.prepare("DELETE FROM access_log WHERE at < ?").run(Date.now() - LOG_RETENTION_MS);
  }

  recentLog(limit: number): LogEntry[] {
    const rows = this.db.prepare("SELECT * FROM access_log ORDER BY at DESC, id DESC LIMIT ?").all(limit) as (Omit<
      LogEntry,
      "success"
    > & { success: number })[];
    return rows.map(({ success, ...rest }) => ({ ...rest, success: !!success }) as LogEntry);
  }
}
