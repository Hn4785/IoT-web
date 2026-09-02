// Các vai trò được định nghĩa trong hệ thống
export type UserRole =
  | "admin"
  | "farm_owner"
  | "client_developer";

// Các trạng thái của người dùng trong hệ thống
export type UserStatus =
  | "active"
  | "inactive"
  | "suspended";

// Quyền truy cập của người dùng đối với các tài nguyên trong hệ thống
export type Permission =
  | "view"
  | "edit"
  | "configure"
  | "manage_alerts"
  | "export_data"
  | "manage_devices";

/**
 * Quyền trên một resource cụ thể.
 * Resource có thể là:
 * Farm -> Plot -> Station
 */
export interface ResourcePermission {
  farmId: string;

  // Có thể không có plot nếu quyền áp dụng toàn Farm.
  plotId?: string;

  // Có thể không có station nếu quyền áp dụng toàn Plot.
  stationId?: string;

  permissions: Permission[];
}

export interface User {
  id: string;
  fullName: string;
  email: string;
  phone?: string;

  role: UserRole;
  status: UserStatus;

  assignedFarmIds: string[]; // Các farm mà user được phép truy cập
  assignedPlotIds: string[]; // Các plot mà user được phép truy cập
  assignedStationIds: string[]; // Các station mà user được phép truy cập

  permissions?: ResourcePermission[]; // Quyền truy cập chi tiết theo resource

  lastLogin?: string;
  createdAt: string;
  updatedAt: string;
}