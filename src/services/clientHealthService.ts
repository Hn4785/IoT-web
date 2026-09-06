import {
  clientApiClient,
  createClientApiConfig,
} from "@/api/clientApiClient";

import { API_ENDPOINTS } from "@/api/endpoints";

import type { ClientApiHealth } from "@/types/clientApi";

/**
 * Service dành cho:
 *
 * GET /api/v1/health
 *
 * Authentication:
 * X-API-Key
 */
export const clientHealthService = {
  async getHealth(
    apiKey: string
  ): Promise<ClientApiHealth> {
    const response =
      await clientApiClient.get<ClientApiHealth>(
        API_ENDPOINTS.clientApi.health,
        createClientApiConfig(apiKey)
      );

    return response.data;
  },
};