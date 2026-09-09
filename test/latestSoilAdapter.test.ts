import assert from "node:assert/strict";
import test from "node:test";

import { API_ENDPOINTS } from "../src/api/endpoints.ts";
import { createLatestSoilService } from "../src/services/latestSoilService.ts";
import {
  adaptLatestSoilData,
  API_SOIL_FIELDS,
  type LatestSoilDataDto,
} from "../src/types/soil.ts";

const dto: LatestSoilDataDto = {
  station: { id: "station-1", name: "NODE01", code: "NODE01" },
  measurement: "soil",
  fields: API_SOIL_FIELDS.map((field, index) => ({
    field,
    value: index + 1,
    unit: null,
    observedAt: `2026-07-24T08:35:0${index}.000Z`,
    quality: index === 0 ? "stale" : "good",
    sensorId: null,
    depthCm: null,
  })),
  fetchedAt: "2026-07-24T08:36:00.000Z",
  isFromCache: true,
  isStale: true,
};

test("latest endpoint is station-scoped", () => {
  assert.equal(API_ENDPOINTS.stations.latest("station-1"), "/stations/station-1/data/latest");
});

test("latest service sends one ordered fields parameter and unwraps the envelope", async () => {
  const calls: unknown[][] = [];
  const client = {
    async get<T>(...args: unknown[]): Promise<{ data: T }> {
      calls.push(args);
      return { data: { success: true, data: dto } as T };
    },
  };
  const result = await createLatestSoilService(client).getLatest("station-1", [
    "moisture",
    "temperature",
  ]);

  assert.equal(result, dto);
  assert.deepEqual(calls, [
    ["/stations/station-1/data/latest", { params: { fields: "moisture,temperature" } }],
  ]);
});

test("latest service omits fields when all fields are requested", async () => {
  const calls: unknown[][] = [];
  const client = {
    async get<T>(...args: unknown[]): Promise<{ data: T }> {
      calls.push(args);
      return { data: { success: true, data: dto } as T };
    },
  };
  await createLatestSoilService(client).getLatest("station-1");
  assert.deepEqual(calls, [["/stations/station-1/data/latest", undefined]]);
});

test("adapter indexes all eight fields without inventing metadata", () => {
  const view = adaptLatestSoilData(dto);

  assert.deepEqual(Object.keys(view.fields), [...API_SOIL_FIELDS]);
  assert.equal(view.fields.temperature?.unit, null);
  assert.equal(view.fields.temperature?.sensorId, null);
  assert.equal(view.fields.temperature?.depthCm, null);
  assert.equal(view.fields.light?.observedAt, "2026-07-24T08:35:07.000Z");
  assert.equal(view.isFromCache, true);
  assert.equal(view.isStale, true);
});
