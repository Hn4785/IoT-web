import type { User } from "@/types/user";

export const requiresPasswordChange = (user: User): boolean =>
  user.status === "PENDING_PASSWORD_CHANGE";
