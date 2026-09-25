import type { UserRole } from "../types/user.ts";

export function stationDetailPath(role: UserRole, stationId: string): string | null {
  const encodedId = encodeURIComponent(stationId);
  if (role === "ADMIN") return `/admin/stations/${encodedId}`;
  if (role === "FARMER") return `/farm-owner/stations/${encodedId}`;
  return null;
}
