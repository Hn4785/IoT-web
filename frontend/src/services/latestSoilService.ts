import type { ApiSuccessEnvelope } from "../types/api.ts";
import type { ApiSoilField, LatestSoilDataDto } from "../types/soil.ts";
import { API_ENDPOINTS } from "../api/endpoints.ts";

interface LatestSoilHttpClient {
  get<T>(url: string, config?: { params?: { fields: string } }): Promise<{ data: T }>;
}

export function createLatestSoilService(client: LatestSoilHttpClient) {
  return {
    async getLatest(
      stationId: string,
      fields?: readonly ApiSoilField[],
    ): Promise<LatestSoilDataDto> {
      const config = fields?.length ? { params: { fields: fields.join(",") } } : undefined;
      const response = await client.get<ApiSuccessEnvelope<LatestSoilDataDto>>(
        API_ENDPOINTS.stations.latest(stationId),
        config,
      );
      return response.data.data;
    },
  };
}

export const latestSoilService = {
  async getLatest(
    stationId: string,
    fields?: readonly ApiSoilField[],
  ): Promise<LatestSoilDataDto> {
    const { apiClient } = await import("../api/apiClient.ts");
    return createLatestSoilService(apiClient).getLatest(stationId, fields);
  },
};
