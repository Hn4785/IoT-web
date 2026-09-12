import assert from "node:assert/strict";
import test from "node:test";

import { API_ENDPOINTS } from "../src/api/endpoints.ts";
import { createStationBrowserService } from "../src/services/stationBrowserService.ts";

test("client developer endpoints match the backend namespace", () => {
  assert.equal(API_ENDPOINTS.clientApi.health, "/health");
  assert.equal(API_ENDPOINTS.clientApi.stations, "/client/stations");
  assert.equal(API_ENDPOINTS.clientApi.data.latest, "/client/data/latest");
  assert.equal(API_ENDPOINTS.clientApi.data.history, "/client/data/history");
});

test("browser hierarchy uses bearer-authenticated backend routes", async () => {
  const calls: unknown[][] = [];
  const client = {
    async get<T>(...args: unknown[]): Promise<{ data: T }> {
      calls.push(args);
      return { data: { success: true, data: { items: [], nextCursor: null } } as T };
    },
  };
  const service = createStationBrowserService(client);

  await service.listFarms();
  await service.listPlots("farm-1");
  await service.listStations("plot-1");

  assert.deepEqual(calls, [
    ["/farms", { params: { limit: 100 } }],
    ["/farms/farm-1/plots", { params: { limit: 100 } }],
    ["/plots/plot-1/stations", { params: { limit: 100 } }],
  ]);
});

test("browser history sends the strict backend query contract", async () => {
  const calls: unknown[][] = [];
  const client = {
    async get<T>(...args: unknown[]): Promise<{ data: T }> {
      calls.push(args);
      return { data: { success: true, data: { stationId: "station-1" } } as T };
    },
  };
  const service = createStationBrowserService(client);
  await service.getHistory("station-1", {
    fields: ["moisture", "temperature"],
    begin: "2026-09-11T00:00:00.000Z",
    end: "2026-09-12T00:00:00.000Z",
    interval: "1h",
    aggregate: "mean",
    limit: 500,
  });

  assert.deepEqual(calls, [[
    "/stations/station-1/data/history",
    { params: {
      fields: "moisture,temperature",
      begin: "2026-09-11T00:00:00.000Z",
      end: "2026-09-12T00:00:00.000Z",
      interval: "1h",
      aggregate: "mean",
      limit: 500,
    } },
  ]]);
});
