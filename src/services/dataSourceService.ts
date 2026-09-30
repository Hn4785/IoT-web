import { API_ENDPOINTS } from "../api/endpoints.ts";
import type { ApiSuccessEnvelope, CursorPage } from "../types/api.ts";
import { unwrapApiResponse } from "../types/api.ts";

export interface DataSource {
  id: string;
  name: string;
  owner: { id: string; displayName: string; role: "ADMIN" | "FARMER" };
  baseUrl: string;
  keyPreview: string | null;
  stationCount: number;
  visibleAccountCount: number;
  connectionStatus: "CONNECTED" | "FAILED";
  lastCheckedAt: string;
  canManageAccess: boolean;
  canRevealKey: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface DataSourceGrant {
  user: { id: string; displayName: string; email: string; role: "FARMER" | "CLIENT_DEVELOPER" };
  stationIds: string[];
  createdAt: string;
}

export interface DataSourceGrantCandidate {
  id: string;
  displayName: string;
  email: string;
  role: "FARMER" | "CLIENT_DEVELOPER";
}

export interface DataSourceStation {
  id: string;
  name: string;
  code: string;
}

export type ResourceChoice = { id: string } | { name: string };

export interface CreateDataSourceRequest {
  name?: string;
  baseUrl: string;
  xApiKey: string;
  farm: ResourceChoice;
  plot: ResourceChoice;
}

interface HttpClient {
  get<T>(url: string, config?: { params?: unknown }): Promise<{ data: T }>;
  post<T>(url: string, body?: unknown): Promise<{ data: T }>;
  put<T>(url: string, body?: unknown): Promise<{ data: T }>;
  delete<T>(url: string): Promise<{ data: T }>;
}

export function createDataSourceService(client: HttpClient) {
  return {
    async list(cursor?: string): Promise<CursorPage<DataSource>> {
      const response = await client.get<ApiSuccessEnvelope<CursorPage<DataSource>>>(
        API_ENDPOINTS.dataSources.base,
        { params: cursor ? { cursor, limit: 100 } : { limit: 100 } },
      );
      return unwrapApiResponse(response.data);
    },
    async create(payload: CreateDataSourceRequest): Promise<DataSource> {
      const response = await client.post<ApiSuccessEnvelope<DataSource>>(
        API_ENDPOINTS.dataSources.base,
        payload,
      );
      return unwrapApiResponse(response.data);
    },
    async listGrants(sourceId: string): Promise<CursorPage<DataSourceGrant>> {
      const response = await client.get<ApiSuccessEnvelope<CursorPage<DataSourceGrant>>>(
        API_ENDPOINTS.dataSources.grants(sourceId),
        { params: { limit: 100 } },
      );
      return unwrapApiResponse(response.data);
    },
    async listStations(sourceId: string): Promise<{ items: DataSourceStation[] }> {
      const response = await client.get<ApiSuccessEnvelope<{ items: DataSourceStation[] }>>(
        API_ENDPOINTS.dataSources.stations(sourceId),
      );
      return unwrapApiResponse(response.data);
    },
    async listGrantCandidates(sourceId: string, cursor?: string): Promise<CursorPage<DataSourceGrantCandidate>> {
      const response = await client.get<ApiSuccessEnvelope<CursorPage<DataSourceGrantCandidate>>>(
        API_ENDPOINTS.dataSources.grantCandidates(sourceId),
        { params: cursor ? { cursor, limit: 100 } : { limit: 100 } },
      );
      return unwrapApiResponse(response.data);
    },
    async setGrantStations(sourceId: string, userId: string, stationIds: string[]): Promise<{ assigned: true; stationIds: string[] }> {
      const response = await client.put<ApiSuccessEnvelope<{ assigned: true; stationIds: string[] }>>(
        API_ENDPOINTS.dataSources.grantStations(sourceId, userId),
        { stationIds },
      );
      return unwrapApiResponse(response.data);
    },
    async grant(sourceId: string, userId: string): Promise<{ assigned: boolean }> {
      const response = await client.put<ApiSuccessEnvelope<{ assigned: boolean }>>(
        API_ENDPOINTS.dataSources.grant(sourceId, userId),
      );
      return unwrapApiResponse(response.data);
    },
    async revoke(sourceId: string, userId: string): Promise<{ assigned: boolean }> {
      const response = await client.delete<ApiSuccessEnvelope<{ assigned: boolean }>>(
        API_ENDPOINTS.dataSources.grant(sourceId, userId),
      );
      return unwrapApiResponse(response.data);
    },
    async reveal(sourceId: string, currentPassword: string): Promise<{ xApiKey: string; expiresInSeconds: 30 }> {
      const response = await client.post<ApiSuccessEnvelope<{ xApiKey: string; expiresInSeconds: 30 }>>(
        API_ENDPOINTS.dataSources.reveal(sourceId),
        { currentPassword },
      );
      return unwrapApiResponse(response.data);
    },
    async test(sourceId: string): Promise<{ connectionStatus: "CONNECTED"; stationCount: number; lastCheckedAt: string }> {
      const response = await client.post<ApiSuccessEnvelope<{ connectionStatus: "CONNECTED"; stationCount: number; lastCheckedAt: string }>>(
        API_ENDPOINTS.dataSources.test(sourceId),
      );
      return unwrapApiResponse(response.data);
    },
    async remove(sourceId: string): Promise<{ removed: true }> {
      const response = await client.delete<ApiSuccessEnvelope<{ removed: true }>>(
        API_ENDPOINTS.dataSources.byId(sourceId),
      );
      return unwrapApiResponse(response.data);
    },
  };
}

export const dataSourceService = createDataSourceService({
  async get<T>(url: string, config?: { params?: unknown }) {
    const { apiClient } = await import("../api/apiClient.ts");
    return apiClient.get<T>(url, config);
  },
  async post<T>(url: string, body?: unknown) {
    const { apiClient } = await import("../api/apiClient.ts");
    return apiClient.post<T>(url, body);
  },
  async put<T>(url: string, body?: unknown) {
    const { apiClient } = await import("../api/apiClient.ts");
    return apiClient.put<T>(url, body);
  },
  async delete<T>(url: string) {
    const { apiClient } = await import("../api/apiClient.ts");
    return apiClient.delete<T>(url);
  },
});
