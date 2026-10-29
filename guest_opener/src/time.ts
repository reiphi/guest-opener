function zonedParts(ts: number, tz: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(new Date(ts));
  const get = (type: string) => Number(parts.find((p) => p.type === type)!.value);
  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    hour: get("hour"),
    minute: get("minute"),
    second: get("second"),
  };
}

function offsetMs(ts: number, tz: string): number {
  const p = zonedParts(ts, tz);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asUtc - (ts - (ts % 1000));
}

/** Converts a `datetime-local` value ("2026-10-12T15:00") in the given zone to epoch ms. */
export function localInputToEpoch(value: string, tz: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(value);
  if (!m) return null;
  const [, y, mo, d, h, mi] = m.map(Number);
  const naive = Date.UTC(y, mo - 1, d, h, mi);
  const first = offsetMs(naive, tz);
  const second = offsetMs(naive - first, tz);
  return naive - second;
}

export function epochToLocalInput(ts: number, tz: string): string {
  const p = zonedParts(ts, tz);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${p.year}-${pad(p.month)}-${pad(p.day)}T${pad(p.hour)}:${pad(p.minute)}`;
}

/** Epoch ms for `daysAhead` days from now at the given local wall-clock time. */
export function localTimeOnDay(daysAhead: number, hour: number, tz: string): number {
  const p = zonedParts(Date.now() + daysAhead * 86_400_000, tz);
  const pad = (n: number) => String(n).padStart(2, "0");
  return localInputToEpoch(`${p.year}-${pad(p.month)}-${pad(p.day)}T${pad(hour)}:00`, tz)!;
}

/** Compact form for lists, e.g. "Fr., 23.10., 15:00". */
export function formatShort(ts: number, tz: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    timeZone: tz,
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(ts));
}

export function formatDateTime(ts: number, tz: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    timeZone: tz,
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(ts));
}
