import assert from "node:assert/strict";
import { createServer } from "node:http";
import test from "node:test";

import {
  buildExplorerRequest,
  createDeveloperExplorerService,
  nextExplorerRequest,
  utcInputToIso,
} from "../src/services/developerExplorerService.ts";

const history = {
  station: "station-2", fields: "moisture,ph", begin: "2026-09-01T00:00",
  end: "2026-09-08T00:00", interval: "raw", aggregate: "", order: "asc", limit: "100",
};

test("endpoint-specific requests omit unrelated parameters and do not supply a station scope", () => {
  assert.equal(buildExplorerRequest("health", history).path, "/health");
  assert.equal(buildExplorerRequest("stations", { ...history, limit: "50" }).path, "/client/stations?limit=50");
  assert.equal(buildExplorerRequest("latest", { station: "station-2" }).path, "/client/data/latest?station=station-2");
  assert.throws(() => buildExplorerRequest("latest", {}), /station/i);
  assert.throws(() => buildExplorerRequest("latest", { station: "a/b" }), /station/i);
});

test("UTC inputs become explicit ISO timestamps and reject normalized impossible dates", () => {
  assert.equal(utcInputToIso("2026-09-01T08:30"), "2026-09-01T08:30:00.000Z");
  for (const invalid of ["", "2026-02-30T00:00", "2026-09-01T25:00", "2026-09-01T08:30+07:00"]) {
    assert.throws(() => utcInputToIso(invalid), /UTC/i);
  }
});

test("history enforces raw and aggregate range boundaries and aggregate compatibility", () => {
  assert.match(buildExplorerRequest("history", history).path, /begin=2026-09-01T00%3A00%3A00.000Z/);
  assert.throws(() => buildExplorerRequest("history", { ...history, end: "2026-09-08T00:01" }), /7 days/);
  assert.throws(() => buildExplorerRequest("history", { ...history, aggregate: "mean" }), /raw/i);
  assert.throws(() => buildExplorerRequest("history", { ...history, interval: "1h" }), /aggregate/i);
  assert.throws(() => buildExplorerRequest("history", { ...history, end: "2026-08-31T00:00" }), /end/i);
  assert.doesNotThrow(() => buildExplorerRequest("history", { ...history, interval: "1h", aggregate: "mean", end: "2026-11-30T00:00" }));
  assert.throws(() => buildExplorerRequest("history", { ...history, interval: "1h", aggregate: "mean", end: "2026-11-30T00:01" }), /90 days/);
});

test("validation rejects unsupported fields, duplicates, limits, enums and oversized cursors", () => {
  for (const fields of ["unknown", "ph,ph", "ph,", "ph, moisture"]) {
    assert.throws(() => buildExplorerRequest("latest", { station: "A", fields }), /fields/i);
  }
  for (const limit of ["0", "101", "1.5", "NaN"]) {
    assert.throws(() => buildExplorerRequest("stations", { limit }), /limit/i);
  }
  assert.doesNotThrow(() => buildExplorerRequest("history", { ...history, limit: "500" }));
  assert.throws(() => buildExplorerRequest("history", { ...history, limit: "501" }), /limit/i);
  for (const invalid of [{ interval: "1w" }, { order: "sideways" }, { interval: "1h", aggregate: "sum" }]) {
    assert.throws(() => buildExplorerRequest("history", { ...history, ...invalid }));
  }
  assert.throws(() => buildExplorerRequest("stations", { cursor: "x".repeat(2049) }), /cursor/i);
});

test("next page preserves the original history filters and replaces only the opaque cursor", () => {
  const request = buildExplorerRequest("history", { ...history, cursor: "old" });
  const next = nextExplorerRequest(request, { success: true, data: { page: { nextCursor: "next_page" } } });
  assert.equal(next?.path, "/client/data/history?station=station-2&fields=moisture%2Cph&begin=2026-09-01T00%3A00%3A00.000Z&end=2026-09-08T00%3A00%3A00.000Z&interval=raw&order=asc&limit=100&cursor=next_page");
  assert.equal(nextExplorerRequest(request, { success: false, data: { page: { nextCursor: "unsafe" } } }), null);
  assert.equal(nextExplorerRequest(request, { success: true, data: { page: { nextCursor: 42 } } }), null);
  assert.equal(nextExplorerRequest(request, { success: true, data: { page: { nextCursor: null } } }), null);
  assert.equal(nextExplorerRequest(buildExplorerRequest("stations", {}), { success: true, data: { items: [], nextCursor: "page2" } })?.path, "/client/stations?cursor=page2");
});

test("real HTTP requests preserve envelopes, status and rate headers without bearer refresh or key disclosure", async () => {
  const received: { url?: string; key?: string; authorization?: string }[] = [];
  const backend = createServer((request, response) => {
    received.push({ url: request.url, key: request.headers["x-api-key"] as string | undefined, authorization: request.headers.authorization });
    response.writeHead(request.url === "/api/v1/health" ? 200 : 401, {
      "Content-Type": "application/json", "X-RateLimit-Limit": "60", "X-RateLimit-Remaining": "0", "X-RateLimit-Reset": "1800000000", "Retry-After": "30",
    });
    response.end(JSON.stringify(request.url === "/api/v1/health" ? { success: true, data: { status: "healthy" } } : { success: false, error: { code: "INVALID_API_KEY", message: "API key is invalid" }, requestId: "req-1" }));
  });
  await new Promise<void>((resolve) => backend.listen(0, "127.0.0.1", resolve));
  const address = backend.address();
  assert.ok(address && typeof address !== "string");
  try {
    const service = createDeveloperExplorerService(`http://127.0.0.1:${address.port}/api/v1`);
    const response = await service.send(buildExplorerRequest("stations", {}), "  test-key\n");
    assert.equal(response.status, 401);
    assert.deepEqual(response.body, { success: false, error: { code: "INVALID_API_KEY", message: "API key is invalid" }, requestId: "req-1" });
    assert.equal(response.headers["x-ratelimit-limit"], "60");
    assert.equal(response.headers["x-ratelimit-remaining"], "0");
    assert.equal(response.headers["x-ratelimit-reset"], "1800000000");
    assert.equal(response.headers["retry-after"], "30");
    assert.ok(!JSON.stringify(response).includes("test-key"));
    const health = await service.send(buildExplorerRequest("health", {}), "test-key");
    assert.deepEqual(health.body, { success: true, data: { status: "healthy" } });
    assert.deepEqual(received, [
      { url: "/api/v1/client/stations", key: "test-key", authorization: undefined },
      { url: "/api/v1/health", key: undefined, authorization: undefined },
    ]);
    await assert.rejects(service.send(buildExplorerRequest("stations", {}), "  "), /API key/);
  } finally {
    await new Promise<void>((resolve, reject) => backend.close((error) => error ? reject(error) : resolve()));
  }
});
