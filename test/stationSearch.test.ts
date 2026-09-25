import assert from "node:assert/strict";
import test from "node:test";

import {
  createStationBrowserService,
  searchAccessibleStations,
} from "../src/services/stationBrowserService.ts";

function envelope<T>(data: T) {
  return { data: { success: true as const, data } };
}

test("station search follows authorized hierarchy cursors and matches code or name", async () => {
  const calls: Array<[string, Record<string, unknown> | undefined]> = [];
  const client = {
    async get<T>(url: string, config?: { params?: Record<string, unknown> }): Promise<{ data: T }> {
      calls.push([url, config?.params]);
      const cursor = config?.params?.cursor;
      if (url === "/farms") return envelope(cursor ? {
        items: [{ id: "farm-2", name: "South" }], nextCursor: null,
      } : { items: [{ id: "farm-1", name: "North" }], nextCursor: "farm-next" }) as { data: T };
      if (url === "/farms/farm-1/plots") return envelope({
        items: [{ id: "plot-1", farmId: "farm-1", name: "Field" }], nextCursor: null,
      }) as { data: T };
      if (url === "/farms/farm-2/plots") return envelope({
        items: [{ id: "plot-2", farmId: "farm-2", name: "Field" }], nextCursor: null,
      }) as { data: T };
      if (url === "/plots/plot-1/stations") return envelope({
        items: [{ id: "s-1", farmId: "farm-1", plotId: "plot-1", name: "Dry plot", code: "NODE01" }], nextCursor: null,
      }) as { data: T };
      if (url === "/plots/plot-2/stations") return envelope({
        items: [{ id: "s-2", farmId: "farm-2", plotId: "plot-2", name: "Station two", code: "NODE02" }], nextCursor: null,
      }) as { data: T };
      throw new Error(`Unexpected URL: ${url}`);
    },
  };

  const result = await searchAccessibleStations("node02", createStationBrowserService(client));
  assert.deepEqual(result, [{ id: "s-2", farmId: "farm-2", plotId: "plot-2", name: "Station two", code: "NODE02" }]);
  assert.deepEqual(calls, [
    ["/farms", { limit: 100 }],
    ["/farms/farm-1/plots", { limit: 100 }],
    ["/plots/plot-1/stations", { limit: 100 }],
    ["/farms", { limit: 100, cursor: "farm-next" }],
    ["/farms/farm-2/plots", { limit: 100 }],
    ["/plots/plot-2/stations", { limit: 100 }],
  ]);
});

test("station search refuses to report a partial global result", async () => {
  const client = {
    async get<T>(): Promise<{ data: T }> {
      return envelope({ items: [], nextCursor: "forever" }) as { data: T };
    },
  };
  await assert.rejects(
    searchAccessibleStations("node", createStationBrowserService(client), 2),
    /too large/i,
  );
});
