import { API_ENDPOINTS } from "../api/endpoints.ts";
import type { ApiSuccessEnvelope } from "../types/api.ts";

interface AuthorityHttpClient {
  post<T>(url: string, body: unknown): Promise<{ data: T }>;
}

export function createAuthorityService(client: AuthorityHttpClient) {
  return {
    async transfer(successorUserId: string, currentPassword: string) {
      const response = await client.post<ApiSuccessEnvelope<{ holderUserId: string }>>(
        API_ENDPOINTS.superAdmin.transfer,
        { successorUserId, currentPassword },
      );
      return response.data.data;
    },
  };
}

export const authorityService = createAuthorityService({
  async post<T>(url: string, body: unknown) {
    const { apiClient } = await import("../api/apiClient.ts");
    return apiClient.post<T>(url, body);
  },
});
