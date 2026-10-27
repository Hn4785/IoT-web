import assert from "node:assert/strict";
import test from "node:test";
import { retainedViewKey } from "../src/utils/retainedScope.ts";

test("view memory is scoped to principal, session identity, role, authority and environment", () => {
  const user = { id: "u1", role: "FARMER", status: "ACTIVE", isSuperAdmin: false };
  const original = retainedViewKey(user, "/api/v1");
  assert.equal(retainedViewKey(user, "/api/v1"), original);
  assert.notEqual(retainedViewKey({ ...user }, "/api/v1"), original);
  assert.notEqual(retainedViewKey(user, "https://other.example.test/api/v1"), original);
  assert.notEqual(retainedViewKey(null, "/api/v1"), original);
  user.role = "ADMIN";
  assert.notEqual(retainedViewKey(user, "/api/v1"), original);
  const admin = retainedViewKey(user, "/api/v1");
  user.isSuperAdmin = true;
  assert.notEqual(retainedViewKey(user, "/api/v1"), admin);
});

test("scope changes invalidate memory without including any authentication secret", () => {
  const user = { id: "u1", role: "FARMER", status: "ACTIVE", isSuperAdmin: false,
    assignedStationIds: ["s1"], sharedSources: [{ id: "source1", stations: [{ id: "s1" }] }] };
  const before = retainedViewKey(user, "/api/v1");
  user.assignedStationIds = [];
  user.sharedSources = [];
  assert.notEqual(retainedViewKey(user, "/api/v1"), before);
  assert.doesNotMatch(before, /token|password|secret/i);
});
