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
import type { ApiSuccessEnvelope } from "@/types/api";
import { unwrapApiResponse } from "@/types/api";

/**
 * Service dành cho Client Developer API.
 *
 * Endpoints:
 *
 * GET /api/v1/client/data/latest
 * GET /api/v1/client/data/history
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
      await clientApiClient.get<ApiSuccessEnvelope<LatestTelemetryData>>(
        API_ENDPOINTS.clientApi.data.latest,
        {
          ...createClientApiConfig(apiKey),
          params,
        }
      );

    return unwrapApiResponse(response.data);
  },

  /**
   * Lấy dữ liệu telemetry lịch sử.
   */
  async getHistoryData(
    apiKey: string,
    params?: HistoryDataQueryParams
  ): Promise<HistoryDataResponse> {
    const response =
      await clientApiClient.get<ApiSuccessEnvelope<HistoryDataResponse>>(
        API_ENDPOINTS.clientApi.data.history,
        {
          ...createClientApiConfig(apiKey),
          params,
        }
      );

    return unwrapApiResponse(response.data);
  },
};
