import assert from "node:assert/strict";
import test from "node:test";

import { createAdminAuditService } from "../src/services/adminAuditService.ts";

test("admin audit list sends server filters and keeps the cursor", async () => {
  const calls: unknown[][] = [];
  const page = {
    items: [{ id: "event-1", action: "USER_UPDATED", result: "SUCCESS" }],
    nextCursor: "next-page",
  };
  const service = createAdminAuditService({
    async get<T>(url: string, config?: { params?: Record<string, unknown> }): Promise<{ data: T }> {
      calls.push([url, config]);
      return { data: { success: true, data: page } } as { data: T };
    },
  });

  assert.deepEqual(await service.list({ action: "USER_UPDATED", result: "SUCCESS", limit: 20, cursor: "first-page" }), page);
  assert.deepEqual(calls, [["/admin/audit-events", {
    params: { action: "USER_UPDATED", result: "SUCCESS", limit: 20, cursor: "first-page" },
  }]]);
});
