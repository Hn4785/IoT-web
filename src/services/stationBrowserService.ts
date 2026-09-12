import { API_ENDPOINTS } from "../api/endpoints.ts";
import type { ApiSuccessEnvelope, CursorPage } from "../types/api.ts";
import type { ApiSoilField, LatestSoilDataDto } from "../types/soil.ts";

export interface BrowserFarm {
  id: string;
  name: string;
}

export interface BrowserPlot {
  id: string;
  farmId: string;
  name: string;
}

export interface BrowserStation {
  id: string;
  farmId: string;
  plotId: string;
  name: string;
  code: string;
}

export interface SoilHistoryPoint {
  observedAt: string;
  value: number;
  quality: "good" | "stale" | "unknown";
}

export interface SoilHistorySeries {
  field: ApiSoilField;
  unit: string | null;
  sensorId: string | null;
  depthCm: number | null;
  points: SoilHistoryPoint[];
}

export interface SoilHistoryData {
  stationId: string;
  measurement: "soil";
  series: SoilHistorySeries[];
  page: { nextCursor: string | null };
  fetchedAt: string;
  isFromCache: boolean;
  isStale: boolean;
}

interface BrowserHttpClient {
  get<T>(url: string, config?: { params?: Record<string, unknown> }): Promise<{ data: T }>;
}

function dataOf<T>(response: { data: ApiSuccessEnvelope<T> }): T {
  return response.data.data;
}

export function createStationBrowserService(client: BrowserHttpClient) {
  return {
    async listFarms(): Promise<CursorPage<BrowserFarm>> {
      return dataOf(await client.get<ApiSuccessEnvelope<CursorPage<BrowserFarm>>>(
        API_ENDPOINTS.farms.base,
        { params: { limit: 100 } },
      ));
    },

    async listPlots(farmId: string): Promise<CursorPage<BrowserPlot>> {
      return dataOf(await client.get<ApiSuccessEnvelope<CursorPage<BrowserPlot>>>(
        API_ENDPOINTS.farms.plots(farmId),
        { params: { limit: 100 } },
      ));
    },

    async listStations(plotId: string): Promise<CursorPage<BrowserStation>> {
      return dataOf(await client.get<ApiSuccessEnvelope<CursorPage<BrowserStation>>>(
        API_ENDPOINTS.stations.byPlot(plotId),
        { params: { limit: 100 } },
      ));
    },

    async getLatest(
      stationId: string,
      fields?: readonly ApiSoilField[],
    ): Promise<LatestSoilDataDto> {
      return dataOf(await client.get<ApiSuccessEnvelope<LatestSoilDataDto>>(
        API_ENDPOINTS.stations.latest(stationId),
        fields?.length ? { params: { fields: fields.join(",") } } : undefined,
      ));
    },

    async getHistory(
      stationId: string,
      options: {
        fields: readonly ApiSoilField[];
        begin: string;
        end: string;
        interval?: "raw" | "5m" | "30m" | "1h" | "1d";
        aggregate?: "mean" | "min" | "max" | "first" | "last";
        limit?: number;
      },
    ): Promise<SoilHistoryData> {
      return dataOf(await client.get<ApiSuccessEnvelope<SoilHistoryData>>(
        API_ENDPOINTS.stations.history(stationId),
        {
          params: {
            ...options,
            fields: options.fields.join(","),
          },
        },
      ));
    },
  };
}

export const stationBrowserService = createStationBrowserService({
  async get<T>(url: string, config?: { params?: Record<string, unknown> }) {
    const { apiClient } = await import("../api/apiClient.ts");
    return apiClient.get<T>(url, config);
  },
});
