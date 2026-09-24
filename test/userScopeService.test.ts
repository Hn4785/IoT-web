import assert from "node:assert/strict";
import { test } from "node:test";

import { createUserScopeService } from "../src/services/userScopeService.ts";

test("farm membership and station grant use the matching write contract", async () => {
  const calls: string[] = [];
  const service = createUserScopeService({
    put: async (url) => { calls.push(`PUT ${url}`); return { data: { success: true, data: { assigned: true } } }; },
    delete: async (url) => { calls.push(`DELETE ${url}`); return { data: { success: true, data: { assigned: false } } }; },
  });

  await service.setFarmMembership("user-1", "farm-1", true);
  await service.setFarmMembership("user-1", "farm-1", false);
  await service.setStationGrant("user-2", "station-2", true);
  await service.setStationGrant("user-2", "station-2", false);

  assert.deepEqual(calls, [
    "PUT /admin/users/user-1/farm-memberships/farm-1",
    "DELETE /admin/users/user-1/farm-memberships/farm-1",
    "PUT /admin/users/user-2/station-grants/station-2",
    "DELETE /admin/users/user-2/station-grants/station-2",
  ]);
});
