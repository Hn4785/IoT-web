import assert from "node:assert/strict";
import test from "node:test";
import axios, { AxiosError, type InternalAxiosRequestConfig } from "axios";
import { authStorage } from "../src/utils/authStorage.ts";

let refreshes = 0;
let failRefresh = false;
let rejectRetry = false;
let dataRequests = 0;
let refreshGate: Promise<void> | null = null;
let onRefreshStarted: (() => void) | null = null;
let late401Gate: Promise<void> | null = null;
let onLate401Started: (() => void) | null = null;
axios.defaults.adapter = async (config: InternalAxiosRequestConfig) => {
  const response = { data: {}, status: 401, statusText: "Unauthorized", headers: {}, config };
  if (config.url === "/auth/refresh") {
    refreshes += 1;
    if (onRefreshStarted) {
      onRefreshStarted();
      onRefreshStarted = null;
    }
    if (refreshGate) {
      await refreshGate;
    } else {
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    if (failRefresh) throw new AxiosError("Unauthorized", "ERR_BAD_REQUEST", config, undefined, response);
    return { ...response, status: 200, data: { success: true, data: { accessToken: "test-fresh-token", expiresIn: 900 } } };
  }
  dataRequests += 1;
  if (late401Gate && config.url === "/late-original" && config.headers.Authorization === "Bearer test-expired-token") {
    onLate401Started?.();
    await late401Gate;
  }
  if (rejectRetry || config.headers.Authorization !== "Bearer test-fresh-token") {
    throw new AxiosError("Unauthorized", "ERR_BAD_REQUEST", config, undefined, response);
  }
  return { ...response, status: 200, data: { success: true, data: { items: [] } } };
};
const { apiClient } = await import("../src/api/apiClient.ts");
const { useAuthStore, setAuthServiceForTesting } = await import("../src/stores/authStore.ts");
const { registerSessionInvalidator } = await import("../src/auth/sessionInvalidation.ts");

const makeUser = (id: string) => ({
  id, email: `${id}@example.com`, role: "FARMER" as const, status: "ACTIVE" as const,
  isSuperAdmin: false, createdAt: "", updatedAt: "", assignedFarmIds: [], assignedPlotIds: [], assignedStationIds: [],
});

test("concurrent expired-token responses refresh once and replay with the new token", async () => {
  refreshes = 0;
  dataRequests = 0;
  authStorage.setAccessToken("test-expired-token");
  const responses = await Promise.all([apiClient.get("/developer/api-keys"), apiClient.get("/developer/api-keys/available-stations")]);
  assert.deepEqual(responses.map(({ status }) => status), [200, 200]);
  assert.equal(refreshes, 1);
  assert.equal(dataRequests, 4);
});

test("a rejected refresh clears the expired token and does not loop", async () => {
  refreshes = 0;
  failRefresh = true;
  authStorage.setAccessToken("test-expired-token");
  await assert.rejects(apiClient.get("/developer/api-keys"));
  assert.equal(refreshes, 1);
  assert.equal(authStorage.getAccessToken(), null);
  failRefresh = false;
});

test("a 401 after retry is returned without refreshing again", async () => {
  refreshes = 0;
  dataRequests = 0;
  rejectRetry = true;
  useAuthStore.getState().login(makeUser("revoked-after-refresh"));
  authStorage.setAccessToken("test-expired-token");
  await assert.rejects(apiClient.get("/developer/api-keys"));
  assert.equal(refreshes, 1);
  assert.equal(dataRequests, 2);
  assert.equal(authStorage.getAccessToken(), null);
  assert.equal(useAuthStore.getState().user, null);
  rejectRetry = false;
});

test("failed login is not retried through refresh", async () => {
  refreshes = 0;
  authStorage.clearAccessToken();
  await assert.rejects(apiClient.post("/auth/login", {}));
  assert.equal(refreshes, 0);
});

test("concurrent expired requests with failed refresh invalidate token and Zustand user exactly once", async () => {
  refreshes = 0;
  failRefresh = true;
  useAuthStore.getState().login(makeUser("user-1"));
  authStorage.setAccessToken("test-expired-token");

  let invalidations = 0;
  const unsubscribe = registerSessionInvalidator(() => {
    invalidations += 1;
  });

  const [res1, res2] = await Promise.allSettled([
    apiClient.get("/developer/api-keys"),
    apiClient.get("/developer/api-keys/available-stations"),
  ]);

  assert.equal(res1.status, "rejected");
  assert.equal(res2.status, "rejected");
  assert.equal(refreshes, 1);
  assert.equal(invalidations, 1);
  assert.equal(authStorage.getAccessToken(), null);
  assert.equal(useAuthStore.getState().user, null);
  assert.equal(useAuthStore.getState().isAuthenticated, false);
  unsubscribe();
  failRefresh = false;

  useAuthStore.getState().login(makeUser("user-later"));
  authStorage.setAccessToken("test-later-token");
  assert.equal(useAuthStore.getState().user?.id, "user-later");
  assert.equal(useAuthStore.getState().isAuthenticated, true);
  assert.equal(authStorage.getAccessToken(), "test-later-token");
});

async function testRefreshRace(fail: boolean, id: string) {
  refreshes = 0;
  failRefresh = fail;
  useAuthStore.getState().login(makeUser(`old-${id}`));
  authStorage.setAccessToken("test-old-token");

  let releaseGate!: () => void;
  const refreshStarted = new Promise<void>((r) => {
    onRefreshStarted = r;
  });
  refreshGate = new Promise<void>((r) => {
    releaseGate = r;
  });

  const req = apiClient.get("/developer/api-keys");
  await refreshStarted;

  authStorage.setAccessToken("test-new-token");
  useAuthStore.getState().login(makeUser(`new-${id}`));

  releaseGate();
  await assert.rejects(req);
  assert.equal(authStorage.getAccessToken(), "test-new-token");
  assert.equal(useAuthStore.getState().user?.id, `new-${id}`);
  assert.equal(useAuthStore.getState().isAuthenticated, true);
  failRefresh = false;
  refreshGate = null;
}

test("an obsolete failed refresh does not clear a newer authenticated session", async () => {
  await testRefreshRace(true, "fail");
});

test("an obsolete successful refresh does not overwrite a newer authenticated session", async () => {
  await testRefreshRace(false, "success");
});

test("concurrent restoreSession calls share one restore flight", async () => {
  let calls = 0;
  let release!: () => void;
  setAuthServiceForTesting({
    refresh: async () => {
      calls += 1;
      await new Promise<void>((r) => {
        release = r;
      });
      return { accessToken: "test-token", expiresIn: 900 };
    },
    getCurrentUser: async () => makeUser("user-restored"),
    clearSession: () => {},
  });

  const p1 = useAuthStore.getState().restoreSession();
  const p2 = useAuthStore.getState().restoreSession();
  release();
  await Promise.all([p1, p2]);

  assert.equal(calls, 1);
  assert.equal(useAuthStore.getState().user?.id, "user-restored");
  setAuthServiceForTesting(null);
});

for (const fail of [false, true]) {
  test(`obsolete session restore ${fail ? "failure" : "success"} preserves a newer login`, async () => {
    let release!: () => void;
    let started!: () => void;
    const startedPromise = new Promise<void>((resolve) => { started = resolve; });
    const gate = new Promise<void>((resolve) => { release = resolve; });
    setAuthServiceForTesting({
      refresh: async () => { started(); await gate; if (fail) throw new Error("Expired session"); },
      getCurrentUser: async () => makeUser("obsolete-user"),
      clearSession: () => { authStorage.clearAccessToken(); },
    });
    const restore = useAuthStore.getState().restoreSession();
    await startedPromise;
    authStorage.setAccessToken("new-login-token");
    useAuthStore.getState().login(makeUser("current-user"));
    release();
    await restore;
    assert.equal(authStorage.getAccessToken(), "new-login-token");
    assert.equal(useAuthStore.getState().user?.id, "current-user");
    assert.equal(useAuthStore.getState().isAuthenticated, true);
    setAuthServiceForTesting(null);
  });
}

test("an old logout completion preserves a replacement login", async () => {
  let release!: () => void;
  let started!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  const begun = new Promise<void>((resolve) => { started = resolve; });
  setAuthServiceForTesting({ refresh: async () => {}, getCurrentUser: async () => makeUser("old"), clearSession: () => {}, logout: async () => { started(); await gate; } });
  useAuthStore.getState().login(makeUser("old"));
  authStorage.setAccessToken("old-token");
  const logout = useAuthStore.getState().logout();
  await begun;
  useAuthStore.getState().login(makeUser("replacement"));
  authStorage.setAccessToken("replacement-token");
  release();
  await logout;
  assert.equal(useAuthStore.getState().user?.id, "replacement");
  assert.equal(authStorage.getAccessToken(), "replacement-token");
  setAuthServiceForTesting(null);
});

test("logout fences an already pending session restore", async () => {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  setAuthServiceForTesting({ refresh: async () => { await gate; }, getCurrentUser: async () => makeUser("old"), clearSession: () => {}, logout: async () => {} });
  useAuthStore.getState().login(makeUser("old"));
  authStorage.setAccessToken("old-token");
  const restore = useAuthStore.getState().restoreSession();
  await useAuthStore.getState().logout();
  release();
  await restore;
  assert.equal(useAuthStore.getState().user, null);
  assert.equal(authStorage.getAccessToken(), null);
  setAuthServiceForTesting(null);
});

test("a request queued before logout cannot refresh the ending session", async () => {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  setAuthServiceForTesting({ refresh: async () => {}, getCurrentUser: async () => makeUser("old"), clearSession: () => {}, logout: async () => { await gate; } });
  useAuthStore.getState().login(makeUser("old"));
  authStorage.setAccessToken("test-expired-token");
  refreshes = 0;
  const request = Promise.allSettled([apiClient.get("/queued-before-logout")]);
  const logout = useAuthStore.getState().logout();
  const result = await request;
  release();
  await logout;
  setAuthServiceForTesting(null);
  assert.equal(result[0].status, "rejected");
  assert.equal(refreshes, 0);
  assert.equal(useAuthStore.getState().user, null);
  assert.equal(useAuthStore.getState().isLoading, false);
  assert.equal(authStorage.getAccessToken(), null);
});

test("a delayed original 401 replays the current token of the same session without another refresh", async () => {
  let release!: () => void;
  let started!: () => void;
  late401Gate = new Promise<void>((resolve) => { release = resolve; });
  const begun = new Promise<void>((resolve) => { started = resolve; });
  onLate401Started = started;
  refreshes = 0;
  useAuthStore.getState().login(makeUser("same-session"));
  authStorage.setAccessToken("test-expired-token");
  const late = apiClient.get("/late-original");
  await begun;
  const first = await apiClient.get("/developer/api-keys");
  assert.equal(first.status, 200);
  release();
  assert.equal((await late).status, 200);
  assert.equal(refreshes, 1);
  assert.equal(useAuthStore.getState().user?.id, "same-session");
  late401Gate = null;
  onLate401Started = null;
});
