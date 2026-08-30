import type { CalibrationStatus } from "./sensor";

export type StationStatus =
  | "online"
  | "offline"
  | "stale"
  | "maintenance"
  | "disabled";

export interface StationLocation {
  latitude: number;
  longitude: number;
}

export interface Station {
  id: string;
  name: string;

  farmId: string;
  plotId: string;
  gatewayId?: string;

  status: StationStatus;

  lastSeen?: string;

  firmwareVersion?: string;

  batteryPercent?: number;
  rssiDbm?: number;

  location?: StationLocation;

  sensorIds: string[];
  sensorCount: number;
  sensorErrorCount: number;
  calibrationStatus?: CalibrationStatus;

  createdAt: string;
  updatedAt: string;
}