import type { User } from "@/types/user";

export const mockAdminUser: User = {
  id: "USR-ADMIN-001",

  fullName: "System Administrator",

  email: "admin@iot.local",

  phone: "0123456789",

  role: "admin",

  status: "active",

  assignedFarmIds: [],

  assignedPlotIds: [],

  assignedStationIds: [],

  permissions: [],

  lastLogin: new Date().toISOString(),

  createdAt: new Date().toISOString(),

  updatedAt: new Date().toISOString(),
};
export const mockFarmOwnerUser: User = {
  id: "USR-FARM-001",
  fullName: "Farm Owner",
  email: "farmer@iot.local",
  phone: "0987654321",

  role: "farm_owner",
  status: "active",

  assignedFarmIds: ["FARM-001"],
  assignedPlotIds: ["PLOT-001", "PLOT-002"],
  assignedStationIds: ["STATION-001", "STATION-002"],

  permissions: [],

  lastLogin: new Date().toISOString(),
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};
export const mockDeveloperUser: User = {
  id: "USR-DEV-001",
  fullName: "Client Developer",
  email: "developer@iot.local",
  phone: "0912345678",

  role: "client_developer",
  status: "active",

  assignedFarmIds: [],
  assignedPlotIds: [],
  assignedStationIds: [],

  permissions: [],

  lastLogin: new Date().toISOString(),
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};