import {
  clientApiClient,
} from "@/api/clientApiClient";

import { API_ENDPOINTS } from "@/api/endpoints";

import type { ClientApiHealth } from "@/types/clientApi";
import type { ApiSuccessEnvelope } from "@/types/api";
import { unwrapApiResponse } from "@/types/api";

/**
 * Service dành cho:
 *
 * GET /api/v1/health
 *
 * Public endpoint; no API key is required.
 */
export const clientHealthService = {
  async getHealth(): Promise<ClientApiHealth> {
    const response =
      await clientApiClient.get<ApiSuccessEnvelope<ClientApiHealth>>(
        API_ENDPOINTS.clientApi.health
      );

    return unwrapApiResponse(response.data);
  },
};
