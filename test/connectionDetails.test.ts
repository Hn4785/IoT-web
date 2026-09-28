import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { parseConnectionDetails } from "../src/utils/connectionDetails.ts";

describe("parseConnectionDetails", () => {
  test("parses curl, chat text and JSON without returning the pasted text", () => {
    assert.deepEqual(
      parseConnectionDetails('curl "https://api.iot.example.com/v1/" -H "X-API-Key: key_abc123"'),
      { baseUrl: "https://api.iot.example.com/v1", xApiKey: "key_abc123" },
    );
    assert.deepEqual(
      parseConnectionDetails("API: https://iot.sensor.org/api x-api-key: secret_xyz"),
      { baseUrl: "https://iot.sensor.org/api", xApiKey: "secret_xyz" },
    );
    assert.deepEqual(
      parseConnectionDetails(JSON.stringify({ url: "https://api.iot.net/v2/", xApiKey: "json_key_789" })),
      { baseUrl: "https://api.iot.net/v2", xApiKey: "json_key_789" },
    );
  });

  test("rejects missing or ambiguous connection details", () => {
    assert.throws(() => parseConnectionDetails("X-API-Key: somekey"), /not found/i);
    assert.throws(
      () => parseConnectionDetails("https://api.example.com X-API-Key: key1 X-API-Key: key2"),
      /ambiguous/i,
    );
    assert.throws(
      () => parseConnectionDetails("https://one.example.com https://two.example.com X-API-Key: key1"),
      /ambiguous/i,
    );
  });

  test("rejects unsafe or request-specific URLs", () => {
    for (const url of [
      "http://api.example.com/v1",
      "https://user:pass@api.example.com/v1",
      "https://api.example.com/v1?station=1",
      "https://api.example.com/v1#section",
    ]) {
      assert.throws(() => parseConnectionDetails(`${url} X-API-Key: key1`), /safe HTTPS API base URL/i);
    }
  });
});
