import { apiClient } from "@/api/apiClient";
import { API_ENDPOINTS } from "@/api/endpoints";
import type { ApiSuccessEnvelope } from "@/types/api";
import { unwrapApiResponse } from "@/types/api";

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

interface IssuedApiKey { key: string; apiKey: DeveloperApiKey }

export const apiKeyService = {
  async list(): Promise<DeveloperApiKey[]> {
    const response = await apiClient.get<ApiSuccessEnvelope<{ items: DeveloperApiKey[] }>>(API_ENDPOINTS.apiKeys.base);
    return unwrapApiResponse(response.data).items;
  },
  async create(name: string): Promise<IssuedApiKey> {
    const response = await apiClient.post<ApiSuccessEnvelope<IssuedApiKey>>(API_ENDPOINTS.apiKeys.base, { name, stationIds: [] });
    return unwrapApiResponse(response.data);
  },
  async rotate(id: string): Promise<IssuedApiKey> {
    const response = await apiClient.post<ApiSuccessEnvelope<IssuedApiKey>>(API_ENDPOINTS.apiKeys.rotate(id));
    return unwrapApiResponse(response.data);
  },
  async revoke(id: string): Promise<void> {
    await apiClient.post(API_ENDPOINTS.apiKeys.revoke(id));
  },
};
