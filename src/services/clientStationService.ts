import {
  clientApiClient,
  createClientApiConfig,
} from "@/api/clientApiClient";

import { API_ENDPOINTS } from "@/api/endpoints";

import type {
  ClientStationListResponse,
  ClientStationQueryParams,
} from "@/types/clientApi";
import type { ApiSuccessEnvelope } from "@/types/api";
import { unwrapApiResponse } from "@/types/api";

/**
 * Service dành cho:
 *
 * GET /api/v1/client/stations
 *
 * Authentication:
 * X-API-Key
 */
export const clientStationService = {
  async getStations(
    apiKey: string,
    params?: ClientStationQueryParams
  ): Promise<ClientStationListResponse> {
    const response =
      await clientApiClient.get<ApiSuccessEnvelope<ClientStationListResponse>>(
        API_ENDPOINTS.clientApi.stations,
        {
          ...createClientApiConfig(apiKey),
          params,
        }
      );

    return unwrapApiResponse(response.data);
  },
};
