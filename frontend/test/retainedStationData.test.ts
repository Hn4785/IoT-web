import assert from "node:assert/strict";
import test from "node:test";

import {
  createInitialFarmerState,
  fenceStationDetailView,
  formatLatestConnectionStatus,
  formatLatestSummaryState,
  isTransientError,
  mergeFarmerLatest,
  mergeFarmerSibling,
  mergeStationMetadata,
  resolveLatestError,
  resolveLatestSuccess,
} from "../src/utils/retainedStationData.ts";
import { adaptLatestSoilData, type LatestSoilDataDto } from "../src/types/soil.ts";

function mockDto(id: string, overrides: Partial<LatestSoilDataDto> = {}): LatestSoilDataDto {
  return {
    station: { id, name: id, code: id },
    measurement: "soil",
    fields: [
      { field: "moisture", value: 30, unit: "%", observedAt: "2026-10-05T12:00:00Z", quality: "good", sensorId: null, depthCm: null },
    ],
    fetchedAt: "2026-10-05T12:00:05Z",
    isFromCache: false,
    isStale: false,
    dataOrigin: "upstream",
    ...overrides,
  };
}

test("sibling-first resolution preserves prior latest fallback on subsequent transient latest failure", () => {
  const initial = createInitialFarmerState("st-1", 1);
  const withLatest = mergeFarmerLatest(initial, "st-1", 1, { ok: true, data: mockDto("st-1") });
  assert.equal(withLatest.latest?.station.id, "st-1");

  // User refreshes: reloadKey becomes 2
  const refreshState = createInitialFarmerState("st-1", 2, withLatest);
  // Sibling (history/alerts) resolves FIRST
  const siblingFirst = mergeFarmerSibling(refreshState, "st-1", 2, { ok: true, data: { items: [] } });
  assert.equal(siblingFirst.retainedFallback?.station.id, "st-1");

  // Subsequent transient latest failure SECOND must NOT lose fallback
  const afterFailure = mergeFarmerLatest(siblingFirst, "st-1", 2, { ok: false, error: new Error("503 Service Unavailable") });
  assert.equal(afterFailure.latest?.station.id, "st-1");
  assert.equal(afterFailure.isRetained, true);
  assert.match(afterFailure.latestError, /503/);
});

test("refresh shows previous latest as pending/last-known but never retains an old history query", () => {
  const old = mergeFarmerSibling(mergeFarmerLatest(createInitialFarmerState("s", 1), "s", 1,
    { ok: true, data: mockDto("s") }), "s", 1, { ok: true, data: "old window" });
  const next = createInitialFarmerState("s", 2, old);
  assert.equal(next.latestPending, true);
  assert.equal(next.isRetained, true);
  assert.equal(next.sibling, null);
  assert.equal(mergeFarmerLatest(next, "s", 1, { ok: true, data: mockDto("s") }), next);
});

test("metadata access loss fences even a later successful latest for that request", () => {
  for (const status of [401, 403, 404]) {
    const old = mergeFarmerLatest(createInitialFarmerState<{ id: string }>("s", 1), "s", 1,
      { ok: true, data: mockDto("s") });
    const denied = mergeStationMetadata(old, "s", 1, { ok: false, error: { isAxiosError: true, response: { status } } });
    assert.equal(denied.latest, null);
    assert.equal(mergeFarmerLatest(denied, "s", 1, { ok: true, data: mockDto("s") }), denied);
  }
  const mismatch = mergeStationMetadata(createInitialFarmerState<{ id: string }>("b", 1), "b", 1,
    { ok: true, data: { id: "a" } });
  assert.equal(mismatch.sibling, null);
  assert.equal(mismatch.accessDenied, true);
});

test("keyed identity helper fences route mismatch before metadata settles and on access denial", () => {
  // Route A to B: latest B resolves before metadata B settles (metadata A still in state)
  const pendingMetaView = fenceStationDetailView({
    routeStationId: "st-B",
    metaStationId: "st-A",
    metaStation: { id: "st-A", name: "Station A", code: "STA" },
    metaAccessDenied: false,
    metaError: "",
    metaPending: true,
    latestStationId: "st-B",
    latest: mockDto("st-B"),
    isRetained: false,
    latestError: "",
    latestPending: false,
  });
  // Station A must NEVER render for route B
  assert.equal(pendingMetaView.station, null);
  assert.equal(pendingMetaView.loading, true);

  // Metadata 403 access denial must fence even a fulfilled latest for same station
  const deniedView = fenceStationDetailView({
    routeStationId: "st-B",
    metaStationId: "st-B",
    metaStation: null,
    metaAccessDenied: true,
    metaError: "Forbidden",
    metaPending: false,
    latestStationId: "st-B",
    latest: mockDto("st-B"),
    isRetained: false,
    latestError: "",
    latestPending: false,
  });
  assert.equal(deniedView.station, null);
  assert.equal(deniedView.latest, null);
  assert.equal(deniedView.isRetained, false);
});

test("pure resolveLatestError retains previous exact-station reading on transient error", () => {
  const prev = mockDto("st-1");
  const res = resolveLatestError("st-1", new Error("Timeout"), prev);
  assert.equal(res.isRetained, true);
  assert.equal(res.data?.fetchedAt, prev.fetchedAt);
  assert.equal(adaptLatestSoilData(res.data!, { isRetained: true }).isStale, true);
});

test("different station or missing previous never retains another station data", () => {
  const res = resolveLatestError("st-B", { isAxiosError: true, response: { status: 500 } }, mockDto("st-A"));
  assert.equal(res.data, null);
  assert.equal(res.isRetained, false);
});

test("401/403/404 clears fallback rather than retaining", () => {
  const res = resolveLatestError("st-1", { isAxiosError: true, response: { status: 403 } }, mockDto("st-1"));
  assert.equal(res.data, null);
  assert.equal(res.isRetained, false);
});

test("successful empty latest clears previous readings and is not retained on next error", () => {
  const empty = mockDto("st-1", { fields: [] });
  const success = resolveLatestSuccess("st-1", empty);
  assert.equal(success.ok, true);
  if (!success.ok) return;
  const nextErr = resolveLatestError("st-1", new Error("Timeout"), success.data);
  assert.equal(nextErr.data, null);
});

test("mismatch station ID is rejected and not published", () => {
  const res = resolveLatestSuccess("st-expected", mockDto("st-wrong"));
  assert.equal(res.ok, false);
});

test("stored dataOrigin and empty never report Live/Connected", () => {
  assert.equal(formatLatestConnectionStatus(mockDto("st-1", { dataOrigin: "stored" }), false, false), "Stored");
  assert.equal(formatLatestSummaryState(mockDto("st-1", { dataOrigin: "stored" }), false), "Stored");
  assert.equal(formatLatestConnectionStatus(mockDto("st-1", { fields: [] }), false, false), "Empty");
  assert.equal(formatLatestSummaryState(mockDto("st-1", { fields: [] }), false), "Empty");
  assert.equal(formatLatestConnectionStatus(mockDto("st-1"), true, false), "Stale");
  assert.equal(formatLatestSummaryState(mockDto("st-1"), true), "Stale");
  assert.equal(formatLatestConnectionStatus(mockDto("st-1"), false, true), "Refreshing...");
  assert.equal(formatLatestConnectionStatus(mockDto("st-1"), false, false), "Connected");
  assert.equal(formatLatestSummaryState(mockDto("st-1"), false), "Live");
});

test("isTransientError distinguishes 401/403/404 from 5xx and timeouts", () => {
  assert.equal(isTransientError(new Error("Timeout")), true);
  assert.equal(isTransientError({ isAxiosError: true, response: { status: 500 } }), true);
  assert.equal(isTransientError({ isAxiosError: true, response: { status: 401 } }), false);
  assert.equal(isTransientError({ isAxiosError: true, response: { status: 403 } }), false);
  assert.equal(isTransientError({ isAxiosError: true, response: { status: 404 } }), false);
  assert.equal(isTransientError({ isAxiosError: true, response: { status: 400 } }), false);
});

test("observed station access loss clears both branches and fences sibling responses", () => {
  for (const status of [401, 403, 404]) {
    const old = mergeFarmerSibling(mergeFarmerLatest(createInitialFarmerState<string>("s", 1), "s", 1,
      { ok: true, data: mockDto("s") }), "s", 1, { ok: true, data: "authorized sibling" });
    const error = { isAxiosError: true, response: { status } };
    for (const denied of [
      mergeFarmerLatest(old, "s", 1, { ok: false, error }),
      mergeFarmerSibling(old, "s", 1, { ok: false, error, label: "history" }),
    ]) {
      assert.equal(denied.latest, null);
      assert.equal(denied.sibling, null);
      assert.equal(denied.retainedFallback, null);
      assert.equal(denied.accessDenied, true);
      assert.equal(mergeFarmerLatest(denied, "s", 1, { ok: true, data: mockDto("s") }), denied);
      assert.equal(mergeFarmerSibling(denied, "s", 1, { ok: true, data: "late sibling" }), denied);
    }
  }
});
