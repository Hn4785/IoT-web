import assert from "node:assert/strict";
import test from "node:test";
import {
  buildHistoryQueryKey, createRequestFence, handleStationHistorySuccess,
  handleStationHistoryError, insertChartGaps, getHonestProvenanceAndCoverage,
  formatHistoryReportCsv, type HistoryQueryParams, type StationHistoryRecord,
  createStationHistoryRequestFence, beginStationHistoryRequest,
  selectHistoryRecords,
} from "../src/utils/retainedHistoryData.ts";
import type { SoilHistoryData } from "../src/services/stationBrowserService.ts";

function sampleData(p?: Partial<SoilHistoryData>): SoilHistoryData {
  return {
    stationId: p?.stationId ?? "sta-1", measurement: "soil",
    series: p?.series ?? [{ field: "moisture", unit: "%", sensorId: "s1", depthCm: 10, points: [
      { observedAt: "2026-10-01T00:00:00.000Z", value: 25.4, quality: "good" },
      { observedAt: "2026-10-01T01:00:00.000Z", value: 25.8, quality: "good" },
    ]}],
    page: p?.page ?? { nextCursor: null }, fetchedAt: p?.fetchedAt ?? "2026-10-01T02:00:00.000Z",
    isFromCache: p?.isFromCache ?? false, isStale: p?.isStale ?? false,
    dataOrigin: p?.dataOrigin ?? "upstream", coverage: p?.coverage ?? { status: "complete" },
  };
}

test("buildHistoryQueryKey produces collision-safe JSON differing by all dimensions", () => {
  const b: HistoryQueryParams = { stationId: "sta-1", fields: ["moisture"], begin: "2026-10-01T00:00:00.000Z", end: "2026-10-02T00:00:00.000Z", interval: "1h", aggregate: "mean", order: "asc", limit: 500, cursor: "" };
  const k = buildHistoryQueryKey(b);
  assert.equal(k, buildHistoryQueryKey({ stationId: "sta-1", fields: ["moisture"], begin: "2026-10-01T00:00:00.000Z", end: "2026-10-02T00:00:00.000Z" }));
  assert.notEqual(k, buildHistoryQueryKey({ ...b, stationId: "sta-2" }));
  assert.notEqual(k, buildHistoryQueryKey({ ...b, begin: "2026-10-01T01:00:00.000Z" }));
  assert.notEqual(k, buildHistoryQueryKey({ ...b, end: "2026-10-02T05:00:00.000Z" }));
  assert.notEqual(k, buildHistoryQueryKey({ ...b, fields: ["temperature"] }));
  assert.notEqual(k, buildHistoryQueryKey({ ...b, cursor: "c1" }));
});

test("transient errors (5xx, 429, 408, network) preserve prior data for exact query; wrong station / 4xx purge", () => {
  const qk = JSON.stringify({ stationId: "sta-1", query: "test" });
  const initial = sampleData({ fetchedAt: "2026-10-01T12:00:00.000Z" });
  const rec = handleStationHistorySuccess(undefined, qk, initial, "sta-1");

  // Transient 503 retains exact query
  const err503 = handleStationHistoryError(rec, qk, { response: { status: 503, data: { message: "Unavailable" } } }, "sta-1");
  assert.ok(err503.data !== null);
  assert.equal(err503.isRetained, true);
  assert.equal(err503.isStale, true);
  assert.equal(err503.fetchedAt, "2026-10-01T12:00:00.000Z");

  // Transient 429 retains
  const err429 = handleStationHistoryError(rec, qk, { response: { status: 429, data: { message: "Rate limited" } } }, "sta-1");
  assert.equal(err429.isRetained, true);

  // Mismatched query purges
  assert.equal(handleStationHistoryError(rec, "otherKey", { response: { status: 500 } }, "sta-1").data, null);

  // Arbitrary 4xx (400, 422) and auth (401, 403, 404) purge
  for (const st of [400, 401, 403, 404, 422]) {
    assert.equal(handleStationHistoryError(rec, qk, { response: { status: st } }, "sta-1").data, null);
  }

  // Wrong response station rejects
  const wrongStationData = sampleData({ stationId: "sta-wrong" });
  const badStationRec = handleStationHistorySuccess(rec, qk, wrongStationData, "sta-1");
  assert.equal(badStationRec.data, null);
  assert.equal(badStationRec.error, "Station ID mismatch");

  // Empty success clears
  const emptyRec = handleStationHistorySuccess(rec, qk, sampleData({ series: [] }), "sta-1");
  assert.equal(emptyRec.data?.series.length, 0);
  assert.equal(emptyRec.isRetained, false);
});

test("multi-station isolation: one station failure does not affect another", () => {
  const qkA = "kA"; const qkB = "kB";
  let map: Record<string, StationHistoryRecord> = {};
  map["sta-A"] = handleStationHistorySuccess(map["sta-A"], qkA, sampleData({ stationId: "sta-A" }), "sta-A");
  map["sta-B"] = handleStationHistoryError(map["sta-B"], qkB, { response: { status: 500, data: { message: "Fail B" } } }, "sta-B");
  assert.ok(map["sta-A"]?.data !== null);
  assert.equal(map["sta-A"]?.error, null);
  assert.equal(map["sta-B"]?.data, null);
  assert.match(map["sta-B"]?.error ?? "", /Fail B/);
});

test("request fence discards out-of-order responses", () => {
  const f = createRequestFence();
  const r1 = f.nextRequestId();
  const r2 = f.nextRequestId();
  assert.equal(f.isCurrent(r1), false);
  assert.equal(f.isCurrent(r2), true);
});

test("honest provenance and coverage: consumes stored before cache, handles truncated/failed", () => {
  // Stored consumed before cache
  assert.equal(getHonestProvenanceAndCoverage(sampleData({ dataOrigin: "stored", isFromCache: true }), false).origin, "stored");
  assert.equal(getHonestProvenanceAndCoverage(sampleData({ isFromCache: true }), false).origin, "cache");
  assert.equal(getHonestProvenanceAndCoverage(sampleData(), true).origin, "browser retained");
  // Truncation overrides complete
  const trunc = getHonestProvenanceAndCoverage(sampleData({ page: { nextCursor: "p2" } }), false);
  assert.equal(trunc.coverageStatus, "partial");
  assert.equal(trunc.isTruncated, true);
  // Station failure forces unknown
  assert.equal(getHonestProvenanceAndCoverage(sampleData(), false, true).coverageStatus, "unknown");
});

test("insertChartGaps inserts null breaks for intervals exceeding bucket without fabricating values", () => {
  const pts = [
    { observedAt: "2026-10-01T00:00:00.000Z", value: 20 },
    { observedAt: "2026-10-01T01:00:00.000Z", value: 21 },
    { observedAt: "2026-10-01T05:00:00.000Z", value: 25 },
  ];
  const g1h = insertChartGaps(pts, "1h");
  assert.equal(g1h.length, 4);
  assert.equal(g1h[2]?.value, null);
  assert.equal(g1h[2]?.observedAt, "2026-10-01T02:00:00.000Z");

  const daily = [
    { observedAt: "2026-10-01T00:00:00.000Z", value: 10 },
    { observedAt: "2026-10-05T00:00:00.000Z", value: 15 },
  ];
  const g1d = insertChartGaps(daily, "1d");
  assert.equal(g1d.length, 3);
  assert.equal(g1d[1]?.value, null);
});

test("formatHistoryReportCsv formats safely escaped metadata and real points only", () => {
  const d = sampleData();
  const csv = formatHistoryReportCsv({
    stationCode: "NODE01", field: "moisture", begin: "2026-10-01", end: "2026-10-02",
    origin: "upstream", coverageStatus: "complete", isRetained: false, fetchedAt: "2026-10-01T02:00:00.000Z",
    points: d.series[0]?.points ?? [], unit: "%",
  });
  assert.match(csv, /# "Query"/);
  assert.match(csv, /# "Source"/);
  assert.match(csv, /# "Coverage"/);
  assert.match(csv, /# "Retained"/);
  assert.match(csv, /observedAt,value,unit,quality/);
  assert.match(csv, /"2026-10-01T00:00:00\.000Z","25\.4","%","good"/);
});

test("mismatchedretainedstation: error for different target station never retains prior station data", () => {
  const qk = "collision-key";
  const recA = handleStationHistorySuccess(undefined, qk, sampleData({ stationId: "sta-A" }), "sta-A");
  const errB = handleStationHistoryError(recA, qk, { response: { status: 503 } }, "sta-B");
  assert.equal(errB.stationId, "sta-B");
  assert.equal(errB.data, null);
  assert.equal(errB.isRetained, false);
});

test("overlappingretriesdeniedthenlatesuccessfenced: older success after newer failure cannot resurrect", () => {
  const fence = createRequestFence();
  const qk = "key-A";
  let rec: StationHistoryRecord | undefined = handleStationHistorySuccess(undefined, qk, sampleData({ stationId: "sta-1" }), "sta-1");
  const req1 = fence.nextRequestId();
  const req2 = fence.nextRequestId();
  if (fence.isCurrent(req2)) {
    rec = handleStationHistoryError(rec, qk, { response: { status: 403 } }, "sta-1");
  }
  assert.equal(rec.data, null);
  if (fence.isCurrent(req1)) {
    rec = handleStationHistorySuccess(rec, qk, sampleData({ stationId: "sta-1" }), "sta-1");
  }
  assert.equal(rec.data, null);
});

test("maliciousCSVnewline/formula: strips newlines and escapes formula triggers in metadata cells", () => {
  const evilCode = "NODE01\n=cmd|' /C calc'!A0,bad";
  const csv = formatHistoryReportCsv({
    stationCode: evilCode, field: "moisture", begin: "2026-10-01", end: "2026-10-02",
    origin: "=evilOrigin", coverageStatus: "complete", isRetained: false,
    points: [{ observedAt: "2026-10-01T00:00:00.000Z", value: 10, quality: "good" }], unit: "=badUnit",
  });
  const lines = csv.split("\n");
  for (const line of lines) {
    if (line.includes("Query") || line.includes("Source") || line.includes("Coverage")) {
      assert.ok(line.startsWith("# "), `Metadata line must start with "# ": ${line}`);
    }
    assert.ok(!line.startsWith("=cmd"), `Unescaped formula line found: ${line}`);
  }
  assert.match(csv, /'=badUnit/);
  assert.match(csv, /'=evilOrigin/);
});

test("station request fencing isolates retries and invalidates every response on scope reset", () => {
  const requests = createStationHistoryRequestFence();
  const a1 = requests.begin("A");
  const b1 = requests.begin("B");
  const a2 = requests.begin("A");
  assert.equal(requests.isCurrent(a1), false);
  assert.equal(requests.isCurrent(b1), true);
  assert.equal(requests.isCurrent(a2), true);
  requests.reset();
  assert.equal(requests.isCurrent(a2), false);
  assert.equal(requests.isCurrent(b1), false);
});

test("pending recheck labels exact-query last-known data stale, but never retains a different query or empty result", () => {
  const prior = handleStationHistorySuccess(null, "query-A", sampleData(), "sta-1");
  const pending = beginStationHistoryRequest(prior, "query-A", "sta-1");
  assert.equal(pending.pending, true);
  assert.equal(pending.isRetained, true);
  assert.equal(pending.data?.isStale, true);
  assert.equal(pending.fetchedAt, prior.fetchedAt);
  assert.equal(beginStationHistoryRequest(prior, "query-B", "sta-1").data, null);
  assert.equal(beginStationHistoryRequest(prior, "query-A", "sta-2").data, null);
  const empty = handleStationHistorySuccess(prior, "query-A", sampleData({ series: [] }), "sta-1");
  assert.equal(beginStationHistoryRequest(empty, "query-A", "sta-1").data, null);
});

test("station-list changes retain only still-authorized exact queries, independent of list order", () => {
  const a = handleStationHistorySuccess(null, "query-A", sampleData({ stationId: "A" }), "A");
  const b = handleStationHistorySuccess(null, "query-B", sampleData({ stationId: "B" }), "B");
  const records = { A: a, B: b };
  assert.deepEqual(selectHistoryRecords(records, ["query-B", "query-A"]), records);
  const onlyA = selectHistoryRecords(records, ["query-A"]);
  assert.deepEqual(Object.keys(onlyA), ["A"]);
  assert.equal(handleStationHistoryError(onlyA.A, "query-A", { status: 503 }, "A").isRetained, true);
  assert.deepEqual(selectHistoryRecords(records, ["new-A-window"]), {});
});
