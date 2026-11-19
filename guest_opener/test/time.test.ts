import assert from "node:assert/strict";
import { test } from "node:test";
import { localInputToEpoch } from "../src/time";

test("local times are converted across daylight saving changes", () => {
  const tz = "Europe/Berlin";
  assert.equal(localInputToEpoch("2026-07-01T15:00", tz), Date.UTC(2026, 6, 1, 13));
  assert.equal(localInputToEpoch("2026-01-15T15:00", tz), Date.UTC(2026, 0, 15, 14));
  // 02:30 does not exist on the spring change; it becomes 03:30 summer time.
  assert.equal(localInputToEpoch("2026-03-29T02:30", tz), Date.UTC(2026, 2, 29, 1, 30));
  // 02:30 exists twice in autumn; the later one (winter time) is used.
  assert.equal(localInputToEpoch("2026-10-25T02:30", tz), Date.UTC(2026, 9, 25, 1, 30));
});

test("impossible dates are refused", () => {
  for (const value of ["2026-02-30T15:00", "2026-13-01T15:00", "2026-01-01T24:00", "2026-01-01T12:60", "morgen"]) {
    assert.equal(localInputToEpoch(value, "Europe/Berlin"), null, value);
  }
  assert.ok(localInputToEpoch("2028-02-29T12:00", "Europe/Berlin"), "leap day");
});
