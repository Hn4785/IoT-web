import assert from "node:assert/strict";
import test from "node:test";
import axios, { AxiosError, type InternalAxiosRequestConfig } from "axios";
import { authStorage } from "../src/utils/authStorage.ts";

let refreshes = 0;
let failRefresh = false;
let rejectRetry = false;
let dataRequests = 0;
axios.defaults.adapter = async (config: InternalAxiosRequestConfig) => {
  const response = { data: {}, status: 401, statusText: "Unauthorized", headers: {}, config };
  if (config.url === "/auth/refresh") {
    refreshes += 1;
    await new Promise((resolve) => setTimeout(resolve, 10));
    if (failRefresh) throw new AxiosError("Unauthorized", "ERR_BAD_REQUEST", config, undefined, response);
    return { ...response, status: 200, data: { success: true, data: { accessToken: "test-fresh-token", expiresIn: 900 } } };
  }
  dataRequests += 1;
  if (rejectRetry || config.headers.Authorization !== "Bearer test-fresh-token") {
    throw new AxiosError("Unauthorized", "ERR_BAD_REQUEST", config, undefined, response);
  }
  return { ...response, status: 200, data: { success: true, data: { items: [] } } };
};
const { apiClient } = await import("../src/api/apiClient.ts");

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
  authStorage.setAccessToken("test-expired-token");
  await assert.rejects(apiClient.get("/developer/api-keys"));
  assert.equal(refreshes, 1);
  assert.equal(dataRequests, 2);
  rejectRetry = false;
});

test("failed login is not retried through refresh", async () => {
  refreshes = 0;
  authStorage.clearAccessToken();
  await assert.rejects(apiClient.post("/auth/login", {}));
  assert.equal(refreshes, 0);
});
