import { API_ENDPOINTS } from "../api/endpoints.ts";
import type { ApiSuccessEnvelope, CursorPage } from "../types/api.ts";
import { unwrapApiResponse } from "../types/api.ts";

export interface AuditEventDto {
  id: string;
  actorUserId: string | null;
  action: string;
  targetType: string;
  targetId: string | null;
  result: "SUCCESS" | "DENIED" | "FAILURE";
  requestId: string;
  metadata: Record<string, string | number | boolean | null>;
  createdAt: string;
}

export interface AuditQuery {
  action?: string;
  targetType?: string;
  result?: AuditEventDto["result"];
  from?: string;
  to?: string;
  limit?: number;
  cursor?: string;
}

interface AuditClient {
  get<T>(url: string, config?: { params?: Record<string, unknown> }): Promise<{ data: T }>;
}

export function createAdminAuditService(client: AuditClient) {
  return {
    async list(query: AuditQuery): Promise<CursorPage<AuditEventDto>> {
      const response = await client.get<ApiSuccessEnvelope<CursorPage<AuditEventDto>>>(
        API_ENDPOINTS.auditEvents,
        { params: { ...query } },
      );
      return unwrapApiResponse(response.data);
    },
  };
}

export const adminAuditService = createAdminAuditService({
  async get<T>(url: string, config?: { params?: Record<string, unknown> }): Promise<{ data: T }> {
    const { apiClient } = await import("../api/apiClient.ts");
    return apiClient.get<T>(url, config);
  },
});
