import assert from "node:assert/strict";
import test from "node:test";

import {
  canResetCredentials,
  canTransferSuperAdminTo,
  requiresSensitiveChangeConfirmation,
} from "../src/pages/admin/userManagementPolicy.ts";

const currentSuperAdmin = {
  id: "super-admin",
  role: "ADMIN" as const,
  status: "ACTIVE" as const,
  isSuperAdmin: true,
};

test("the current Super Admin never receives a reset-credentials action", () => {
  assert.equal(canResetCredentials(currentSuperAdmin, currentSuperAdmin), false);
});

test("only a different active Admin can receive Super Admin authority", () => {
  assert.equal(canTransferSuperAdminTo(currentSuperAdmin, {
    id: "successor",
    role: "ADMIN",
    status: "ACTIVE",
    isSuperAdmin: false,
  }), true);
  assert.equal(canTransferSuperAdminTo(currentSuperAdmin, {
    id: "farmer",
    role: "FARMER",
    status: "ACTIVE",
    isSuperAdmin: false,
  }), false);
  assert.equal(canTransferSuperAdminTo(currentSuperAdmin, {
    id: "disabled-admin",
    role: "ADMIN",
    status: "DISABLED",
    isSuperAdmin: false,
  }), false);
});

test("role and status changes require a second confirmation before save", () => {
  assert.equal(requiresSensitiveChangeConfirmation(
    { role: "FARMER", status: "ACTIVE" },
    { role: "ADMIN", status: "ACTIVE" },
  ), true);
  assert.equal(requiresSensitiveChangeConfirmation(
    { role: "FARMER", status: "ACTIVE" },
    { role: "FARMER", status: "ACTIVE" },
  ), false);
});
