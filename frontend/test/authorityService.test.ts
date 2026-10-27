import assert from "node:assert/strict";
import test from "node:test";

import { createAuthorityService } from "../src/services/authorityService.ts";

test("Super Admin transfer uses the protected backend contract", async () => {
  const requests: Array<{ url: string; body: unknown }> = [];
  const service = createAuthorityService({
    async post<T>(url: string, body: unknown) {
      requests.push({ url, body });
      return { data: { success: true, data: { holderUserId: "successor" } } as T };
    },
  });

  const result = await service.transfer("successor", "current-password");

  assert.deepEqual(requests, [{
    url: "/admin/super-admin/transfer",
    body: { successorUserId: "successor", currentPassword: "current-password" },
  }]);
  assert.equal(result.holderUserId, "successor");
});
