import assert from "node:assert/strict";
import test from "node:test";

import { createApiKeyService } from "../src/services/apiKeyService.ts";
import { copyText, normalizeApiKey } from "../src/utils/credentialInput.ts";

test("API key creation sends the selected station scopes", async () => {
  const calls: unknown[][] = [];
  const client = {
    async get<T>(): Promise<{ data: T }> {
      return { data: { success: true, data: { items: [] } } as T };
    },
    async post<T>(...args: unknown[]): Promise<{ data: T }> {
      calls.push(args);
      return {
        data: {
          success: true,
          data: {
            key: "iot_live_test_secret",
            apiKey: { id: "key-1", stationIds: ["station-1"] },
          },
        } as T,
      };
    },
  };

  await createApiKeyService(client).create("NODE01 test", ["station-1"]);

  assert.deepEqual(calls, [[
    "/developer/api-keys",
    { name: "NODE01 test", stationIds: ["station-1"] },
  ]]);
});

test("available API-key stations use the dedicated bearer endpoint", async () => {
  const calls: string[] = [];
  const client = {
    async get<T>(url: string): Promise<{ data: T }> {
      calls.push(url);
      return {
        data: {
          success: true,
          data: { items: [{ id: "station-1", name: "NODE01", code: "NODE01" }] },
        } as T,
      };
    },
    async post<T>(): Promise<{ data: T }> {
      throw new Error("not used");
    },
  };

  const stations = await createApiKeyService(client).listAvailableStations();

  assert.deepEqual(calls, ["/developer/api-keys/available-stations"]);
  assert.deepEqual(stations, [{ id: "station-1", name: "NODE01", code: "NODE01" }]);
});

test("API Explorer removes accidental surrounding whitespace from API keys", () => {
  assert.equal(normalizeApiKey("  iot_live_example\r\n"), "iot_live_example");
});

test("copyText reports clipboard success and denial without leaking the value", async () => {
  let copied = "";
  assert.equal(await copyText("secret", { writeText: async (value) => { copied = value; } }), true);
  assert.equal(copied, "secret");
  assert.equal(await copyText("secret", { writeText: async () => { throw new Error("denied"); } }), false);
});
