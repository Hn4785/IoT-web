import type { ReactNode } from "react";
import { Navigate, Outlet } from "react-router-dom";

import { useAuth } from "@/hooks/useAuth";
import type { UserRole } from "@/types/user";

interface RoleRouteProps {
  allowedRoles: UserRole[];
  children?: ReactNode;
}

export default function RoleRoute({
  allowedRoles,
  children,
}: RoleRouteProps) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return null;
  }

  if (!user) {
    return (
      <Navigate
        to="/login"
        replace
      />
    );
  }

  const hasAccess = allowedRoles.includes(user.role);

  if (!hasAccess) {
    return <Navigate to="/unauthorized" replace />;
  }

  return children ? <>{children}</> : <Outlet />;
}