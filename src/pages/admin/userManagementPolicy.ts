type ManagedUser = {
  id: string;
  role: "ADMIN" | "FARMER" | "CLIENT_DEVELOPER";
  status: "ACTIVE" | "DISABLED" | "PENDING_PASSWORD_CHANGE";
  isSuperAdmin: boolean;
};

export function canResetCredentials(actor: ManagedUser | null, target: ManagedUser): boolean {
  if (!actor || target.isSuperAdmin || target.id === actor.id) return false;
  return actor.isSuperAdmin || target.role !== "ADMIN";
}

export function canTransferSuperAdminTo(actor: ManagedUser | null, target: ManagedUser): boolean {
  return Boolean(
    actor?.isSuperAdmin &&
      target.id !== actor.id &&
      !target.isSuperAdmin &&
      target.role === "ADMIN" &&
      target.status === "ACTIVE",
  );
}

export function requiresSensitiveChangeConfirmation(
  current: Pick<ManagedUser, "role" | "status">,
  next: Pick<ManagedUser, "role" | "status">,
): boolean {
  return current.role !== next.role || current.status !== next.status;
}
