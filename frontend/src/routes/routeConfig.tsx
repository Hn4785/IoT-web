import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import type { UserRole } from "@/types/user";
export { getDefaultRouteByRole } from "@/auth/defaultRoute";

import {
  AdminAlertCenter, AdminDashboard, AlertActionCenter, ApiSources,
  ApiDocs, ApiExplorer, ApiKeys, ApiMetrics, ApiPermissions, AuditLogs,
  ChangePassword, ConfigurationProposals, DeveloperDashboard, DeviceHealth,
  DeviceManagement, FarmDashboard, FarmerApiSources, ForgotPassword, HistoricalAnalysis,
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
    path: "/admin/api-sources",
    roles: ["ADMIN"],
    element: <ApiSources />,
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
    path: "/farm-owner/stations/:stationId",
    roles: ["FARMER"],
    element: <StationDetail />,
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
    path: "/farm-owner/api-sources",
    roles: ["FARMER"],
    element: <FarmerApiSources />,
  },
  {
    path: "/farm-owner/alerts",
    roles: ["FARMER"],
    element: <Navigate to="/farm-owner/alert-center" replace />,
  },

  // =========================
  // CLIENT DEVELOPER
  // =========================
  {
    path: "/developer/dashboard",
    roles: ["CLIENT_DEVELOPER"],
    element: <DeveloperDashboard />,
  },
  // --- Canonical API Access ---
  {
    path: "/developer/api-access",
    roles: ["CLIENT_DEVELOPER"],
    element: <Navigate to="/developer/api-access/keys" replace />,
  },
  {
    path: "/developer/api-access/keys",
    roles: ["CLIENT_DEVELOPER"],
    element: <ApiKeys />,
  },
  {
    path: "/developer/api-access/scope",
    roles: ["CLIENT_DEVELOPER"],
    element: <ApiPermissions />,
  },
  // --- Canonical API Tools ---
  {
    path: "/developer/api-tools",
    roles: ["CLIENT_DEVELOPER"],
    element: <Navigate to="/developer/api-tools/docs" replace />,
  },
  {
    path: "/developer/api-tools/docs",
    roles: ["CLIENT_DEVELOPER"],
    element: <ApiDocs />,
  },
  {
    path: "/developer/api-tools/explorer",
    roles: ["CLIENT_DEVELOPER"],
    element: <ApiExplorer />,
  },
  // --- Legacy redirects (one compatibility cycle) ---
  {
    path: "/developer/api-keys",
    roles: ["CLIENT_DEVELOPER"],
    element: <Navigate to="/developer/api-access/keys" replace />,
  },
  {
    path: "/developer/api-permissions",
    roles: ["CLIENT_DEVELOPER"],
    element: <Navigate to="/developer/api-access/scope" replace />,
  },
  {
    path: "/developer/api-docs",
    roles: ["CLIENT_DEVELOPER"],
    element: <Navigate to="/developer/api-tools/docs" replace />,
  },
  {
    path: "/developer/api-explorer",
    roles: ["CLIENT_DEVELOPER"],
    element: <Navigate to="/developer/api-tools/explorer" replace />,
  },
  // --- API Metrics (hidden from nav, still accessible) ---
  {
    path: "/developer/api-metrics",
    roles: ["CLIENT_DEVELOPER"],
    element: <ApiMetrics />,
  },
];
