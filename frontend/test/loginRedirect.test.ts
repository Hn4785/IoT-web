import assert from "node:assert/strict";
import { test } from "node:test";
import { getLoginRedirectByRole } from "../src/auth/defaultRoute.ts";

test("login discards a previous account's route without weakening role boundaries", () => {
  assert.equal(getLoginRedirectByRole("ADMIN", "/farm-owner/api-sources"), "/admin");
  assert.equal(getLoginRedirectByRole("ADMIN", "/developer/dashboard"), "/admin");
  assert.equal(getLoginRedirectByRole("FARMER", "/admin/users"), "/farm-owner/dashboard");
  assert.equal(getLoginRedirectByRole("CLIENT_DEVELOPER", "/admin"), "/developer/dashboard");
  assert.equal(getLoginRedirectByRole("ADMIN", "/admin/api-sources"), "/admin/api-sources");
  assert.equal(getLoginRedirectByRole("FARMER", "/farm-owner/history-reports"), "/farm-owner/history-reports");
  for (const path of [undefined, "/unauthorized", "//evil.example", "https://evil.example/admin", "/administrator", "/admin/../farm-owner", "/admin\\users"]) {
    assert.equal(getLoginRedirectByRole("ADMIN", path), "/admin");
  }
});
