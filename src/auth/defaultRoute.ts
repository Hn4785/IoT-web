import type { UserRole } from "@/types/user";

export const getDefaultRouteByRole = (role: UserRole): string => {
  switch (role) {
    case "ADMIN": return "/admin";
    case "FARMER": return "/farm-owner/dashboard";
    case "CLIENT_DEVELOPER": return "/developer/dashboard";
  }
};
