import type { ReactNode } from "react";
import type { UserRole } from "@/types/user";

import Login from "@/pages/auth/Login";
import ForgotPassword from "@/pages/auth/ForgotPassword";

import AdminDashboard from "@/pages/admin/AdminDashboard";
import UserManagement from "@/pages/admin/UserManagement";
import IoTConfiguration from "@/pages/admin/IoTConfiguration";
import DeviceManagement from "@/pages/admin/DeviceManagement";
import AuditLogs from "@/pages/admin/AuditLogs";

import FarmDashboard from "@/pages/farm-owner/FarmDashboard";
import HistoryReport from "@/pages/farm-owner/HistoryReport";
import NotificationSettings from "@/pages/farm-owner/NotificationSettings";
import AlertActionCenter from "@/pages/farm-owner/AlertActionCenter";

import DeveloperDashboard from "@/pages/developer/DeveloperDashboard";
import ApiKeys from "@/pages/developer/ApiKeys";
import ApiPermissions from "@/pages/developer/ApiPermissions";
import ApiDocs from "@/pages/developer/ApiDocs";
import ApiExplorer from "@/pages/developer/ApiExplorer";
import ApiMetrics from "@/pages/developer/ApiMetrics";

export interface AppRoute {
  path: string;
  element: ReactNode;
  roles?: UserRole[];
  children?: AppRoute[];
}

export const publicRoutes: AppRoute[] = [
  {
    path: "/login",
    element: <Login />,
  },
  {
    path: "/forgot-password",
    element: <ForgotPassword />,
  },
];

export const protectedRoutes: AppRoute[] = [
  // =========================
  // ADMIN
  // =========================
  {
    path: "/admin",
    roles: ["admin"],
    element: <AdminDashboard />,
  },
  {
    path: "/admin/users",
    roles: ["admin"],
    element: <UserManagement />,
  },
  {
    path: "/admin/configuration",
    roles: ["admin"],
    element: <IoTConfiguration />,
  },
  {
    path: "/admin/devices",
    roles: ["admin"],
    element: <DeviceManagement />,
  },
  {
    path: "/admin/audit-logs",
    roles: ["admin"],
    element: <AuditLogs />,
  },

  // =========================
  // FARM OWNER
  // =========================
  {
    path: "/farm-owner",
    roles: ["farm_owner"],
    element: <FarmDashboard />,
  },
  {
    path: "/farm-owner/reports",
    roles: ["farm_owner"],
    element: <HistoryReport />,
  },
  {
    path: "/farm-owner/notifications",
    roles: ["farm_owner"],
    element: <NotificationSettings />,
  },
  {
    path: "/farm-owner/alerts",
    roles: ["farm_owner"],
    element: <AlertActionCenter />,
  },

  // =========================
  // CLIENT DEVELOPER
  // =========================
  {
    path: "/developer",
    roles: ["client_developer"],
    element: <DeveloperDashboard />,
  },
  {
    path: "/developer/api-keys",
    roles: ["client_developer"],
    element: <ApiKeys />,
  },
  {
    path: "/developer/permissions",
    roles: ["client_developer"],
    element: <ApiPermissions />,
  },
  {
    path: "/developer/docs",
    roles: ["client_developer"],
    element: <ApiDocs />,
  },
  {
    path: "/developer/explorer",
    roles: ["client_developer"],
    element: <ApiExplorer />,
  },
  {
    path: "/developer/metrics",
    roles: ["client_developer"],
    element: <ApiMetrics />,
  },
];

export const getDefaultRouteByRole = (role: UserRole): string => {
  switch (role) {
    case "admin":
      return "/admin";

    case "technician":
      return "/technician";

    case "operator":
      return "/operator";

    case "farm_owner":
      return "/farm-owner";

    case "client_developer":
      return "/developer";

    default:
      return "/login";
  }
};