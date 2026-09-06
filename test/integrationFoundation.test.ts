import assert from "node:assert/strict";
import test from "node:test";

import { createSingleFlight } from "../src/api/refreshCoordinator.ts";
import { unwrapApiResponse } from "../src/types/api.ts";
import { authStorage } from "../src/utils/authStorage.ts";
import { restoreAuthenticatedUser } from "../src/auth/restoreAuthenticatedUser.ts";
import { normalizeApiError } from "../src/utils/apiError.ts";
import { normalizeBackendUser } from "../src/services/normalizeBackendUser.ts";
import { requiresPasswordChange } from "../src/auth/passwordChange.ts";

test("temporary-password accounts require a password change", () => {
  assert.equal(requiresPasswordChange({ status: "PENDING_PASSWORD_CHANGE" } as never), true);
  assert.equal(requiresPasswordChange({ status: "ACTIVE" } as never), false);
});

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

test("restoreAuthenticatedUser refreshes before loading the current user", async () => {
  const calls: string[] = [];
  const user = { id: "user-1" };

  const result = await restoreAuthenticatedUser(
    async () => { calls.push("refresh"); },
    async () => { calls.push("me"); return user; },
    () => { calls.push("clear"); },
  );

  assert.equal(result, user);
  assert.deepEqual(calls, ["refresh", "me"]);
});

test("restoreAuthenticatedUser clears local auth state when refresh fails", async () => {
  let cleared = false;

  const result = await restoreAuthenticatedUser(
    async () => { throw new Error("expired"); },
    async () => ({ id: "unreachable" }),
    () => { cleared = true; },
  );

  assert.equal(result, null);
  assert.equal(cleared, true);
});

test("normalizeApiError reads the backend error envelope", () => {
  const result = normalizeApiError({
    isAxiosError: true,
    message: "Request failed",
    response: {
      status: 401,
      data: {
        success: false,
        error: { code: "INVALID_CREDENTIALS", message: "Invalid email or password" },
        requestId: "request-1",
      },
    },
  });

  assert.equal(result.code, "INVALID_CREDENTIALS");
  assert.equal(result.message, "Invalid email or password");
  assert.equal(result.status, 401);
});

test("normalizeBackendUser supplies empty UI assignment collections", () => {
  const user = normalizeBackendUser({
    id: "user-1",
    email: "farmer@example.com",
    displayName: "Farmer",
    role: "FARMER",
    status: "ACTIVE",
    isSuperAdmin: false,
    createdAt: "2026-09-06T00:00:00.000Z",
    updatedAt: "2026-09-06T00:00:00.000Z",
  });

  assert.deepEqual(user.assignedFarmIds, []);
  assert.deepEqual(user.assignedPlotIds, []);
  assert.deepEqual(user.assignedStationIds, []);
});
