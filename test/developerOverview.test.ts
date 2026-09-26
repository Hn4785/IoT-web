import assert from "node:assert/strict";
import test from "node:test";

import type { DeveloperApiKey } from "../src/services/apiKeyService.ts";
import {
  getApiKeyStatus,
  getGrantedKeyStations,
  summarizeDeveloperAccess,
} from "../src/utils/developerOverview.ts";

const now = Date.parse("2026-09-26T12:00:00Z");
const key: DeveloperApiKey = {
  id: "key-1", name: "Weather integration", prefix: "iot_test",
  createdAt: "2026-09-01T00:00:00Z", expiresAt: "2026-10-01T00:00:00Z",
  revokedAt: null, lastUsedAt: null, requestsPerMinute: 120,
  stationIds: ["station-1"],
};
const stations = [
  { id: "station-1", name: "North", code: "N01" },
  { id: "station-2", name: "South", code: "S01" },
];

// Catches the wrong expiry comparison, revoked keys labelled active, or an
// invalid expiry being accepted as usable. Expectations are hand-derived.
for (const [name, values, expected] of [
  ["unexpired", {}, "active"],
  ["expired", { expiresAt: "2026-09-25T12:00:00Z" }, "expired"],
  ["at the expiry boundary", { expiresAt: "2026-09-26T12:00:00Z" }, "expired"],
  ["invalid expiry", { expiresAt: "invalid" }, "expired"],
  ["revoked", { revokedAt: "2026-09-20T00:00:00Z" }, "revoked"],
  ["revoked and expired", { revokedAt: "2026-09-20T00:00:00Z", expiresAt: "2026-09-21T00:00:00Z" }, "revoked"],
] as const) {
  test(`API key status is correct for ${name} credentials`, () => {
    assert.equal(getApiKeyStatus({ ...key, ...values }, now), expected);
  });
}

test("key scope excludes stations no longer granted and does not duplicate access", () => {
  assert.deepEqual(getGrantedKeyStations({ ...key, stationIds: ["station-1", "removed", "station-1"] }, stations), [
    { id: "station-1", name: "North", code: "N01" },
  ]);
});

test("an empty key scope never expands to all account grants", () => {
  assert.deepEqual(getGrantedKeyStations({ ...key, stationIds: [] }, stations), []);
});

test("a key cannot retain station access after all account grants are removed", () => {
  assert.deepEqual(getGrantedKeyStations(key, []), []);
});

test("overview counts loaded statuses and deduplicates stations covered by active keys only", () => {
  const result = summarizeDeveloperAccess([
    key,
    { ...key, id: "key-2", stationIds: ["station-1", "removed"] },
    { ...key, id: "key-3", expiresAt: "2026-09-01T00:00:00Z", stationIds: ["station-2"] },
    { ...key, id: "key-4", revokedAt: "2026-09-22T00:00:00Z", stationIds: ["station-2"] },
  ], stations, now);
  assert.deepEqual(result, { loaded: 4, active: 2, expired: 1, revoked: 1, availableStations: 2, coveredStations: 1 });
});

test("overview reports no covered stations for an account with no grants", () => {
  assert.deepEqual(summarizeDeveloperAccess([key], [], now), {
    loaded: 1, active: 1, expired: 0, revoked: 0, availableStations: 0, coveredStations: 0,
  });
});
