import type { User, UserRole, UserStatus } from "../types/user.ts";

export interface BackendUser {
  id: string;
  email: string;
  displayName: string;
  role: UserRole;
  status: UserStatus;
  isSuperAdmin: boolean;
  createdAt: string;
  updatedAt: string;
}

export function normalizeBackendUser(user: BackendUser): User {
  return {
    ...user,
    assignedFarmIds: [],
    assignedPlotIds: [],
    assignedStationIds: [],
  };
}
