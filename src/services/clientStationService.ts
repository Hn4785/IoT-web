import {
  clientApiClient,
  createClientApiConfig,
} from "@/api/clientApiClient";

import { API_ENDPOINTS } from "@/api/endpoints";

import type {
  ClientStationListResponse,
  ClientStationQueryParams,
} from "@/types/clientApi";

/**
 * Service dành cho:
 *
 * GET /api/v1/stations
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
      await clientApiClient.get<ClientStationListResponse>(
        API_ENDPOINTS.clientApi.stations,
        {
          ...createClientApiConfig(apiKey),
          params,
        }
      );

    return response.data;
  },
};