import type { ReactNode } from "react";
import type { UserRole } from "@/types/user";
export { getDefaultRouteByRole } from "@/auth/defaultRoute";

import {
  AdminAlertCenter, AdminDashboard, AgriculturalAlerts, AlertActionCenter,
  ApiDocs, ApiExplorer, ApiKeys, ApiMetrics, ApiPermissions, AuditLogs,
  ChangePassword, ConfigurationProposals, DeveloperDashboard, DeviceHealth,
  DeviceManagement, FarmDashboard, ForgotPassword, HistoricalAnalysis,
  HistoryReport, IoTConfiguration, Login, NotificationSettings,
  RealtimeSoilMonitoring, StationDetail, UserManagement,
} from "./routeComponents";

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
  { path: "/change-password", element: <ChangePassword /> },
  // =========================
  // ADMIN
  // =========================
  {
    path: "/admin",
    roles: ["ADMIN"],
    element: <AdminDashboard />,
  },
  {
    path: "/admin/users",
    roles: ["ADMIN"],
    element: <UserManagement />,
  },
  {
    path: "/admin/configuration",
    roles: ["ADMIN"],
    element: <IoTConfiguration />,
  },
  {
    path: "/admin/devices",
    roles: ["ADMIN"],
    element: <DeviceManagement />,
  },
  {
    path: "/admin/audit-logs",
    roles: ["ADMIN"],
    element: <AuditLogs />,
  },
  {
  path: "/admin/device-health",
  roles: ["ADMIN"],
  element: <DeviceHealth />,
},

{
  path: "/admin/stations/:stationId",
  roles: ["ADMIN"],
  element: <StationDetail />,
},

{
  path: "/admin/alert-center",
  roles: ["ADMIN"],
  element: <AdminAlertCenter />,
},

{
  path: "/admin/config-proposals",
  roles: ["ADMIN"],
  element: <ConfigurationProposals />,
},

  // =========================
  // FARM OWNER
  // =========================
  {
    path: "/farm-owner/dashboard",
    roles: ["FARMER"],
    element: <FarmDashboard />,
  },
  {
  path: "/farm-owner/soil-dashboard",
  roles: ["FARMER"],
  element: <RealtimeSoilMonitoring />,
  },
  {
  path: "/farm-owner/historical-analysis",
  roles: ["FARMER"],
  element: <HistoricalAnalysis />,
  },
  {
    path: "/farm-owner/history-reports",
    roles: ["FARMER"],
    element: <HistoryReport />,
  },
  {
    path: "/farm-owner/notifications",
    roles: ["FARMER"],
    element: <NotificationSettings />,
  },
  {
    path: "/farm-owner/alert-center",
    roles: ["FARMER"],
    element: <AlertActionCenter />,
  },
  {
  path: "/farm-owner/alerts",
  roles: ["FARMER"],
  element: <AgriculturalAlerts />,
  },

  // =========================
  // CLIENT DEVELOPER
  // =========================
  {
    path: "/developer/dashboard",
    roles: ["CLIENT_DEVELOPER"],
    element: <DeveloperDashboard />,
  },
  {
    path: "/developer/api-keys",
    roles: ["CLIENT_DEVELOPER"],
    element: <ApiKeys />,
  },
  {
    path: "/developer/api-permissions",
    roles: ["CLIENT_DEVELOPER"],
    element: <ApiPermissions />,
  },
  {
    path: "/developer/api-docs",
    roles: ["CLIENT_DEVELOPER"],
    element: <ApiDocs />,
  },
  {
    path: "/developer/api-explorer",
    roles: ["CLIENT_DEVELOPER"],
    element: <ApiExplorer />,
  },
  {
    path: "/developer/api-metrics",
    roles: ["CLIENT_DEVELOPER"],
    element: <ApiMetrics />,
  },
];
