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

export interface SoilHistoryCoverageRange {
  begin: string;
  end: string;
}

export interface SoilHistoryCoverageField {
  field: ApiSoilField;
  ranges: SoilHistoryCoverageRange[];
}

export interface SoilHistoryCoverage {
  status: "complete" | "partial" | "unknown";
  fields?: SoilHistoryCoverageField[];
}

export interface SoilHistoryData {
  stationId: string;
  measurement: "soil";
  series: SoilHistorySeries[];
  page: { nextCursor: string | null };
  fetchedAt: string;
  isFromCache: boolean;
  isStale: boolean;
  dataOrigin?: "upstream" | "stored";
  coverage?: SoilHistoryCoverage;
}

interface BrowserHttpClient {
  get<T>(url: string, config?: { params?: Record<string, unknown> }): Promise<{ data: T }>;
}

function dataOf<T>(response: { data: ApiSuccessEnvelope<T> }): T {
  return response.data.data;
}

export function createStationBrowserService(client: BrowserHttpClient) {
  return {
    async listFarms(cursor?: string): Promise<CursorPage<BrowserFarm>> {
      return dataOf(await client.get<ApiSuccessEnvelope<CursorPage<BrowserFarm>>>(
        API_ENDPOINTS.farms.base,
        { params: { limit: 100, ...(cursor ? { cursor } : {}) } },
      ));
    },

    async listPlots(farmId: string, cursor?: string): Promise<CursorPage<BrowserPlot>> {
      return dataOf(await client.get<ApiSuccessEnvelope<CursorPage<BrowserPlot>>>(
        API_ENDPOINTS.farms.plots(farmId),
        { params: { limit: 100, ...(cursor ? { cursor } : {}) } },
      ));
    },

    async listStations(plotId: string, cursor?: string): Promise<CursorPage<BrowserStation>> {
      return dataOf(await client.get<ApiSuccessEnvelope<CursorPage<BrowserStation>>>(
        API_ENDPOINTS.stations.byPlot(plotId),
        { params: { limit: 100, ...(cursor ? { cursor } : {}) } },
      ));
    },

    async getStation(stationId: string): Promise<BrowserStation> {
      return dataOf(await client.get<ApiSuccessEnvelope<BrowserStation>>(
        API_ENDPOINTS.stations.byId(stationId),
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
        order?: "asc" | "desc";
        cursor?: string;
      },
    ): Promise<SoilHistoryData> {
      const { fields, order, cursor, ...rest } = options;
      return dataOf(await client.get<ApiSuccessEnvelope<SoilHistoryData>>(
        API_ENDPOINTS.stations.history(stationId),
        {
          params: {
            ...rest,
            fields: fields.join(","),
            ...(order ? { order } : {}),
            ...(cursor ? { cursor } : {}),
          },
        },
      ));
    },
  };
}

type SearchHierarchy = Pick<ReturnType<typeof createStationBrowserService>,
  "listFarms" | "listPlots" | "listStations">;

export async function searchAccessibleStations(
  query: string,
  hierarchy: SearchHierarchy = stationBrowserService,
  maxRequests = 50,
): Promise<BrowserStation[]> {
  const needle = query.trim().toLocaleLowerCase();
  if (!needle) return [];

  let requests = 0;
  async function request<T>(load: () => Promise<T>): Promise<T> {
    if (requests >= maxRequests) throw new Error("Station scope is too large to search here.");
    requests += 1;
    return load();
  }

  const matches: BrowserStation[] = [];
  let farmCursor: string | undefined;
  do {
    const farms = await request(() => hierarchy.listFarms(farmCursor));
    for (const farm of farms.items) {
      let plotCursor: string | undefined;
      do {
        const plots = await request(() => hierarchy.listPlots(farm.id, plotCursor));
        for (const plot of plots.items) {
          let stationCursor: string | undefined;
          do {
            const stations = await request(() => hierarchy.listStations(plot.id, stationCursor));
            matches.push(...stations.items.filter((station) =>
              station.code.toLocaleLowerCase().includes(needle)
              || station.name.toLocaleLowerCase().includes(needle)));
            stationCursor = stations.nextCursor ?? undefined;
          } while (stationCursor);
        }
        plotCursor = plots.nextCursor ?? undefined;
      } while (plotCursor);
    }
    farmCursor = farms.nextCursor ?? undefined;
  } while (farmCursor);

  return matches;
}

export const stationBrowserService = createStationBrowserService({
  async get<T>(url: string, config?: { params?: Record<string, unknown> }) {
    const { apiClient } = await import("../api/apiClient.ts");
    return apiClient.get<T>(url, config);
  },
});
