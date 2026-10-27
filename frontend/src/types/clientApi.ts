import type { CursorPage } from "./api";
import type { LatestSoilDataDto } from "./soil";

/**
 * ========================================
 * HEALTH API
 * ========================================
 */

export type ApiHealthStatus =
  | "healthy"
  | "degraded"
  | "unhealthy"
  | "unknown";

export interface ClientApiHealth {
  service: string;
  status: ApiHealthStatus;
  version: string;
  environment: string;
  time: string;
}

/**
 * ========================================
 * STATIONS API
 * ========================================
 */

export interface ClientApiStation {
  id: string;
  name: string;
  farmId: string;
  plotId: string;
  code: string;
}

export interface ClientStationQueryParams {
  limit?: number;
  cursor?: string;
}

export type ClientStationListResponse = CursorPage<ClientApiStation>;

/**
 * ========================================
 * LATEST DATA API
 * ========================================
 */

export interface LatestDataQueryParams {
  station: string;
  fields?: string;
}

export type LatestTelemetryData = LatestSoilDataDto;

/**
 * ========================================
 * HISTORY DATA API
 * ========================================
 */

export interface HistoryDataQueryParams {
  station: string;
  fields?: string;
  begin: string;
  end: string;
  interval?: "raw" | "5m" | "30m" | "1h" | "1d";
  aggregate?: "mean" | "min" | "max" | "first" | "last";
  order?: "asc" | "desc";
  limit?: number;
  cursor?: string;
}

export interface SoilHistoryPointDto {
  observedAt: string;
  value: number;
  quality: "good" | "stale" | "unknown";
}

export interface SoilHistorySeriesDto {
  field: string;
  unit: string | null;
  sensorId: string | null;
  depthCm: number | null;
  points: SoilHistoryPointDto[];
}

export interface HistoryDataResponse {
  stationId: string;
  measurement: "soil";
  series: SoilHistorySeriesDto[];
  page: { nextCursor: string | null };
  fetchedAt: string;
  isFromCache: boolean;
  isStale: boolean;
}
