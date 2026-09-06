/**
 * ========================================
 * CLIENT DEVELOPER API TYPES
 * ========================================
 *
 * Types dành cho các API:
 *
 * GET /api/v1/health
 * GET /api/v1/stations
 * GET /api/v1/data/latest
 * GET /api/v1/data/history
 *
 * Lưu ý:
 * SRS hiện xác nhận endpoint nhưng chưa cung cấp
 * JSON response schema chính thức.
 *
 * Các type dưới đây là frontend contract tạm thời
 * và có thể cập nhật khi Backend API specification hoàn chỉnh.
 */

/**
 * Generic API response wrapper.
 *
 * Có thể không cần nếu Backend trả data trực tiếp.
 */
export interface ClientApiResponse<T> {
  data: T;
  message?: string;
}

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
  status: ApiHealthStatus;

  timestamp?: string;

  version?: string;

  uptime?: number;
}

/**
 * ========================================
 * STATIONS API
 * ========================================
 */

export interface ClientApiStation {
  id: string;

  name: string;

  farmId?: string;

  plotId?: string;

  status?: string;

  lastSeen?: string;

  gatewayId?: string;

  firmware?: string;

  battery?: number;

  rssi?: number;
}

export interface ClientStationQueryParams {
  page?: number;

  limit?: number;

  farmId?: string;

  plotId?: string;

  status?: string;
}

export interface ClientStationListResponse {
  items: ClientApiStation[];

  total?: number;

  page?: number;

  limit?: number;
}

/**
 * ========================================
 * LATEST DATA API
 * ========================================
 */

export interface LatestDataQueryParams {
  stationId?: string;

  sensorId?: string;

  metric?: string;
}

export interface LatestTelemetryData {
  stationId: string;

  sensorId?: string;

  metric: string;

  value: number;

  unit?: string;

  timestamp: string;

  quality?: string;
}

/**
 * ========================================
 * HISTORY DATA API
 * ========================================
 */

export interface HistoryDataQueryParams {
  stationId?: string;

  sensorId?: string;

  metric?: string;

  from?: string;

  to?: string;

  interval?: string;
}

export interface HistoricalTelemetryData {
  stationId: string;

  sensorId?: string;

  metric: string;

  value: number;

  unit?: string;

  timestamp: string;

  quality?: string;
}

export interface HistoryDataResponse {
  items: HistoricalTelemetryData[];

  total?: number;
}