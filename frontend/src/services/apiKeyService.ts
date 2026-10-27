import { API_ENDPOINTS } from "../api/endpoints.ts";
import type { ApiSuccessEnvelope } from "../types/api.ts";
import { unwrapApiResponse } from "../types/api.ts";

export interface DeveloperApiKey {
  id: string;
  name: string;
  prefix: string;
  expiresAt: string;
  requestsPerMinute: number;
  lastUsedAt: string | null;
  revokedAt: string | null;
  createdAt: string;
  stationIds: string[];
}

export interface AvailableApiKeyStation {
  id: string;
  name: string;
  code: string;
}

interface IssuedApiKey { key: string; apiKey: DeveloperApiKey }

interface ApiKeyHttpClient {
  get<T>(url: string): Promise<{ data: T }>;
  post<T>(url: string, body?: unknown): Promise<{ data: T }>;
}

export function createApiKeyService(client: ApiKeyHttpClient) {
  return {
  async list(): Promise<DeveloperApiKey[]> {
    const response = await client.get<ApiSuccessEnvelope<{ items: DeveloperApiKey[] }>>(API_ENDPOINTS.apiKeys.base);
    return unwrapApiResponse(response.data).items;
  },
  async listAvailableStations(): Promise<AvailableApiKeyStation[]> {
    const response = await client.get<ApiSuccessEnvelope<{ items: AvailableApiKeyStation[] }>>(
      API_ENDPOINTS.apiKeys.availableStations,
    );
    return unwrapApiResponse(response.data).items;
  },
  async create(name: string, stationIds: readonly string[]): Promise<IssuedApiKey> {
    const response = await client.post<ApiSuccessEnvelope<IssuedApiKey>>(API_ENDPOINTS.apiKeys.base, { name, stationIds: [...stationIds] });
    return unwrapApiResponse(response.data);
  },
  async rotate(id: string): Promise<IssuedApiKey> {
    const response = await client.post<ApiSuccessEnvelope<IssuedApiKey>>(API_ENDPOINTS.apiKeys.rotate(id));
    return unwrapApiResponse(response.data);
  },
  async revoke(id: string): Promise<void> {
    await client.post(API_ENDPOINTS.apiKeys.revoke(id));
  },
  };
}

export const apiKeyService = createApiKeyService({
  async get<T>(url: string) {
    const { apiClient } = await import("../api/apiClient.ts");
    return apiClient.get<T>(url);
  },
  async post<T>(url: string, body?: unknown) {
    const { apiClient } = await import("../api/apiClient.ts");
    return apiClient.post<T>(url, body);
  },
});
