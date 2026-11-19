import assert from "node:assert/strict";
import { test } from "node:test";
import { PERMANENT_UNTIL, RETENTION_MS, Store } from "../src/store";

test("guest stays are deleted a year after departure, admin users are kept", () => {
  const store = new Store(":memory:");
  const now = Date.now();
  const stay = (token: string, valid_until: number, role: "guest" | "admin" = "guest") =>
    store.createStay({ token, role, guest_name: token, pin: "123456", valid_from: valid_until - 86_400_000, valid_until });
  stay("old", now - RETENTION_MS - 86_400_000);
  stay("recent", now - RETENTION_MS + 86_400_000);
  stay("admin", PERMANENT_UNTIL, "admin");
  assert.equal(store.getStay("old"), null);
  assert.ok(store.getStay("recent"));
  assert.ok(store.getStay("admin"));
});
