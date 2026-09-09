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

export const API_SOIL_FIELDS = [
  "temperature",
  "moisture",
  "ec",
  "ph",
  "nitrogen",
  "phosphorus",
  "potassium",
  "light",
] as const;

export type ApiSoilField = (typeof API_SOIL_FIELDS)[number];
export type ApiSoilQuality = "good" | "stale" | "unknown";

export interface LatestSoilFieldDto {
  readonly field: ApiSoilField;
  readonly value: number;
  readonly unit: string | null;
  readonly observedAt: string;
  readonly quality: ApiSoilQuality;
  readonly sensorId: string | null;
  readonly depthCm: number | null;
}

export interface LatestSoilDataDto {
  readonly station: Readonly<{ id: string; name: string; code: string }>;
  readonly measurement: "soil";
  readonly fields: readonly LatestSoilFieldDto[];
  readonly fetchedAt: string;
  readonly isFromCache: boolean;
  readonly isStale: boolean;
}

export interface LatestSoilView {
  readonly station: LatestSoilDataDto["station"];
  readonly fields: Readonly<Partial<Record<ApiSoilField, LatestSoilFieldDto>>>;
  readonly fetchedAt: string;
  readonly isFromCache: boolean;
  readonly isStale: boolean;
}

export function adaptLatestSoilData(data: LatestSoilDataDto): LatestSoilView {
  const fields: Partial<Record<ApiSoilField, LatestSoilFieldDto>> = {};
  for (const reading of data.fields) fields[reading.field] = reading;
  return {
    station: data.station,
    fields,
    fetchedAt: data.fetchedAt,
    isFromCache: data.isFromCache,
    isStale: data.isStale,
  };
}
