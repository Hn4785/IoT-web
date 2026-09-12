import type { ReactNode } from "react";
import type { UserRole } from "@/types/user";
export { getDefaultRouteByRole } from "@/auth/defaultRoute";

import Login from "@/pages/auth/Login";
import ForgotPassword from "@/pages/auth/ForgotPassword";
import ChangePassword from "@/pages/auth/ChangePassword";

import AdminDashboard from "@/pages/admin/AdminDashboard";
import UserManagement from "@/pages/admin/UserManagement";
import IoTConfiguration from "@/pages/admin/IoTConfiguration";
import DeviceManagement from "@/pages/admin/DeviceManagement";
import AuditLogs from "@/pages/admin/AuditLogs";
import DeviceHealth from "@/pages/admin/DeviceHealth";
import StationDetail from "../pages/admin/StationDetail";
import AdminAlertCenter from "@/pages/admin/AdminAlertCenter";
import ConfigurationProposals from "@/pages/admin/ConfigurationProposals";

import FarmDashboard from "@/pages/farm-owner/FarmDashboard";
import RealtimeSoilMonitoring from "@/pages/farm-owner/RealtimeSoilMonitoring";
import HistoricalAnalysis from "@/pages/farm-owner/HistoricalAnalysis";
import AgriculturalAlerts from "@/pages/farm-owner/AgriculturalAlerts";
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
