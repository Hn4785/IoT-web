import {
  clientApiClient,
  createClientApiConfig,
} from "@/api/clientApiClient";

import { API_ENDPOINTS } from "@/api/endpoints";

import type {
  HistoryDataQueryParams,
  HistoryDataResponse,
  LatestDataQueryParams,
  LatestTelemetryData,
} from "@/types/clientApi";

/**
 * Service dành cho Client Developer API.
 *
 * Endpoints:
 *
 * GET /api/v1/data/latest
 * GET /api/v1/data/history
 *
 * Authentication:
 * X-API-Key
 */
export const telemetryService = {
  /**
   * Lấy dữ liệu telemetry mới nhất.
   */
  async getLatestData(
    apiKey: string,
    params?: LatestDataQueryParams
  ): Promise<LatestTelemetryData> {
    const response =
      await clientApiClient.get<LatestTelemetryData>(
        API_ENDPOINTS.clientApi.data.latest,
        {
          ...createClientApiConfig(apiKey),
          params,
        }
      );

    return response.data;
  },

  /**
   * Lấy dữ liệu telemetry lịch sử.
   */
  async getHistoryData(
    apiKey: string,
    params?: HistoryDataQueryParams
  ): Promise<HistoryDataResponse> {
    const response =
      await clientApiClient.get<HistoryDataResponse>(
        API_ENDPOINTS.clientApi.data.history,
        {
          ...createClientApiConfig(apiKey),
          params,
        }
      );

    return response.data;
  },
};