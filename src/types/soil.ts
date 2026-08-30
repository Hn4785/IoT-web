export type QualityFlag =
  | "good"
  | "stale"
  | "out_of_range"
  | "sensor_error"
  | "uncalibrated"
  | "test"
  | "unknown";

export type SoilField =
  | "temperature"
  | "moisture"
  | "ec"
  | "ph"
  | "nitrogen"
  | "phosphorus"
  | "potassium";

export interface SoilValue {
  value: number;
  unit: string;
  quality: QualityFlag;
  measuredAt: string;
}

export interface SoilTelemetry {
  temperature?: SoilValue;
  moisture?: SoilValue;
  ec?: SoilValue;
  ph?: SoilValue;
  nitrogen?: SoilValue;
  phosphorus?: SoilValue;
  potassium?: SoilValue;
}

export interface DeviceStatus {
  batteryPercent?: number;
  rssiDbm?: number;
  firmwareVersion?: string;
}

export interface SoilTelemetryRecord {
  schemaVersion: string;
  messageId: string;
  tenantId: string;
  gatewayId: string;
  stationId: string;
  deviceId: string;
  sensorId: string;
  measurement: "soil";
  measuredAt: string;
  receivedAt?: string;
  seq?: number;
  telemetry: SoilTelemetry;
  deviceStatus?: DeviceStatus;
}

export interface LatestSoilData {
  farmId: string;
  plotId: string;
  stationId: string;
  sensorId: string;

  depth?: number;
  depthUnit?: "cm" | "m";

  telemetry: SoilTelemetry;

  lastUpdated: string;

  connectionStatus?: "connected" | "disconnected";
}

export interface SoilHistoryPoint {
  timestamp: string;
  value: number;
  unit: string;
  quality: QualityFlag;
}