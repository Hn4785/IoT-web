import type { UserRole } from "@/types/user";

export const getDefaultRouteByRole = (role: UserRole): string => {
  switch (role) {
    case "ADMIN": return "/admin";
    case "FARMER": return "/farm-owner/dashboard";
    case "CLIENT_DEVELOPER": return "/developer/dashboard";
  }
};

export const getLoginRedirectByRole = (role: UserRole, requestedPath?: string): string => {
  const fallback = getDefaultRouteByRole(role);
  const root = role === "ADMIN" ? "/admin" : role === "FARMER" ? "/farm-owner" : "/developer";
  if (!requestedPath || /[\\?#%]/.test(requestedPath) || requestedPath.split("/").some(segment => segment === "." || segment === "..")) return fallback;
  return requestedPath === root || requestedPath.startsWith(`${root}/`) ? requestedPath : fallback;
};
