// Trạng thái hoạt động
export type FarmStatus =
  | "active"
  | "inactive";

  // Vị trí địa lý của farm
export interface FarmLocation {
  latitude: number;
  longitude: number;
}

export interface Farm {
  id: string;
  name: string;
  code: string;
  ownerId: string;

  address?: string;
  location?: FarmLocation;


  plotCount?: number;
  stationCount?: number;
  gatewayCount: number;
  sensorCount?: number;

  status: FarmStatus;

  createdAt: string;
  updatedAt: string;
}