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
  assignments?: {
    farmIds: string[];
    stationIds: string[];
  };
}

export function normalizeBackendUser(user: BackendUser): User {
  const { assignments, ...base } = user;
  return {
    ...base,
    assignedFarmIds: assignments?.farmIds ?? [],
    assignedPlotIds: [],
    assignedStationIds: assignments?.stationIds ?? [],
  };
}
