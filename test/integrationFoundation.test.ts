import assert from "node:assert/strict";
import test from "node:test";

import { createSingleFlight } from "../src/api/refreshCoordinator.ts";
import { unwrapApiResponse } from "../src/types/api.ts";
import { authStorage } from "../src/utils/authStorage.ts";

test("unwrapApiResponse returns backend envelope data", () => {
  assert.deepEqual(
    unwrapApiResponse({ success: true, data: { status: "healthy" } }),
    { status: "healthy" },
  );
});

test("authStorage keeps the access token in memory and clears it", () => {
  authStorage.setAccessToken("access-token");
  assert.equal(authStorage.getAccessToken(), "access-token");

  authStorage.clearAccessToken();
  assert.equal(authStorage.getAccessToken(), null);
});

test("createSingleFlight shares one concurrent operation", async () => {
  let calls = 0;
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const run = createSingleFlight(async () => {
    calls += 1;
    await gate;
    return "new-token";
  });

  const first = run();
  const second = run();
  release();

  assert.deepEqual(await Promise.all([first, second]), ["new-token", "new-token"]);
  assert.equal(calls, 1);
});

test("createSingleFlight allows another operation after failure", async () => {
  let calls = 0;
  const run = createSingleFlight(async () => {
    calls += 1;
    if (calls === 1) throw new Error("refresh failed");
    return "recovered";
  });

  await assert.rejects(run(), /refresh failed/);
  assert.equal(await run(), "recovered");
  assert.equal(calls, 2);
});
