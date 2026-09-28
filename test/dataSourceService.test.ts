import assert from "node:assert/strict";
import { test } from "node:test";

import { createDataSourceService } from "../src/services/dataSourceService.ts";

test("data source service maps the approved endpoints and unwraps envelopes", async () => {
  const calls: Array<{ method: string; url: string; body?: unknown }> = [];
  const source = {
    id: "source-1", name: "North field", owner: { id: "user-1", displayName: "Owner", role: "ADMIN" as const },
    baseUrl: "https://api.example.com", keyPreview: "1234", stationCount: 5,
    visibleAccountCount: 2, connectionStatus: "CONNECTED" as const,
    lastCheckedAt: "2026-09-28T00:00:00.000Z", canManageAccess: true, canRevealKey: true,
    createdAt: "2026-09-28T00:00:00.000Z", updatedAt: "2026-09-28T00:00:00.000Z",
  };
  const client = {
    async get<T>(url: string) { calls.push({ method: "GET", url }); return { data: { success: true, data: url.endsWith("/grants") ? { items: [], nextCursor: null } : { items: [source], nextCursor: null } } as T }; },
    async post<T>(url: string, body?: unknown) { calls.push({ method: "POST", url, body }); return { data: { success: true, data: url.endsWith("/reveal") ? { xApiKey: "secret", expiresInSeconds: 30 } : source } as T }; },
    async put<T>(url: string) { calls.push({ method: "PUT", url }); return { data: { success: true, data: { assigned: true } } as T }; },
    async delete<T>(url: string) { calls.push({ method: "DELETE", url }); return { data: { success: true, data: { assigned: false } } as T }; },
  };
  const service = createDataSourceService(client);

  assert.deepEqual((await service.list()).items, [source]);
  await service.create({ name: "North field", baseUrl: source.baseUrl, xApiKey: "secret", plotId: "plot-1" });
  await service.listGrants("source-1");
  await service.grant("source-1", "user-2");
  await service.revoke("source-1", "user-2");
  assert.deepEqual(await service.reveal("source-1", "long-current-password"), { xApiKey: "secret", expiresInSeconds: 30 });

  assert.deepEqual(calls.map(({ method, url }) => `${method} ${url}`), [
    "GET /data-sources", "POST /data-sources", "GET /data-sources/source-1/grants",
    "PUT /data-sources/source-1/grants/user-2", "DELETE /data-sources/source-1/grants/user-2",
    "POST /data-sources/source-1/reveal",
  ]);
});
