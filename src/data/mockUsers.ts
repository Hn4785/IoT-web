import type { User } from "@/types/user";

export const mockUsers: User[] = [
  {
    id: "USR-ADMIN-001",
    displayName: "System Administrator",
    email: "admin@iot.local",
    phone: "0123456789",

    role: "ADMIN",
    isSuperAdmin: true,
    status: "ACTIVE",

    assignedFarmIds: [],
    assignedPlotIds: [],
    assignedStationIds: [],

    permissions: [],

    lastLogin: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },

  {
    id: "USR-FARM-001",
    displayName: "Farm Owner",
    email: "farmer@iot.local",
    phone: "0987654321",

    role: "FARMER",
    isSuperAdmin: false,
    status: "ACTIVE",

    assignedFarmIds: ["FARM-001"],
    assignedPlotIds: ["PLOT-001", "PLOT-002"],
    assignedStationIds: ["STATION-001", "STATION-002"],

    permissions: [],

    lastLogin: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },

  {
    id: "USR-DEV-001",
    displayName: "Client Developer",
    email: "developer@iot.local",
    phone: "0912345678",

    role: "CLIENT_DEVELOPER",
    isSuperAdmin: false,
    status: "ACTIVE",

    assignedFarmIds: [],
    assignedPlotIds: [],
    assignedStationIds: [],

    permissions: [],

    lastLogin: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

// Giữ các export riêng để tương thích với Login.tsx hiện tại
export const mockAdminUser = mockUsers[0];

export const mockFarmOwnerUser = mockUsers[1];

export const mockDeveloperUser = mockUsers[2];