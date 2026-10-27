import type { AxiosInstance } from "axios";

import { apiClient } from "../api/apiClient.ts";
import { API_ENDPOINTS } from "../api/endpoints.ts";
import type { ApiSuccessEnvelope } from "../types/api.ts";
import type {
  AlertDto,
  AlertQuery,
  AlertRuleDto,
  AlertRuleQuery,
  CreateAlertRuleInput,
  CursorPage,
  StationFieldMetadataResponse,
  UpdateAlertRuleInput,
} from "../types/alertApi.ts";

type HttpClient = Pick<AxiosInstance, "get" | "post" | "patch">;

export function createAlertService(client: HttpClient) {
  return {
    async listAlerts(params: AlertQuery = {}): Promise<CursorPage<AlertDto>> {
      const response = await client.get<ApiSuccessEnvelope<CursorPage<AlertDto>>>(
        API_ENDPOINTS.alerts.base,
        { params },
      );
      return response.data.data;
    },

    async getAlert(id: string): Promise<AlertDto> {
      const response = await client.get<ApiSuccessEnvelope<AlertDto>>(API_ENDPOINTS.alerts.byId(id));
      return response.data.data;
    },

    async acknowledge(id: string, note?: string): Promise<AlertDto> {
      const response = await client.post<ApiSuccessEnvelope<AlertDto>>(
        API_ENDPOINTS.alerts.acknowledgements(id),
        note ? { note } : {},
        { headers: { "Idempotency-Key": crypto.randomUUID() } },
      );
      return response.data.data;
    },

    async resolve(id: string, note?: string): Promise<AlertDto> {
      const response = await client.post<ApiSuccessEnvelope<AlertDto>>(
        API_ENDPOINTS.alerts.resolutions(id),
        note ? { note } : {},
        { headers: { "Idempotency-Key": crypto.randomUUID() } },
      );
      return response.data.data;
    },

    async listRules(stationId: string, params: AlertRuleQuery = {}): Promise<CursorPage<AlertRuleDto>> {
      const response = await client.get<ApiSuccessEnvelope<CursorPage<AlertRuleDto>>>(
        API_ENDPOINTS.alertRules.byStation(stationId),
        { params },
      );
      return response.data.data;
    },

    async getFieldMetadata(stationId: string): Promise<StationFieldMetadataResponse> {
      const response = await client.get<ApiSuccessEnvelope<StationFieldMetadataResponse>>(
        API_ENDPOINTS.stations.fieldMetadata(stationId),
      );
      return {
        fields: response.data.data?.fields ?? [],
        canManageRules: Boolean(response.data.data?.canManageRules),
      };
    },

    async createRule(stationId: string, input: CreateAlertRuleInput): Promise<AlertRuleDto> {
      const response = await client.post<ApiSuccessEnvelope<AlertRuleDto>>(
        API_ENDPOINTS.alertRules.byStation(stationId),
        input,
        { headers: { "Idempotency-Key": crypto.randomUUID() } },
      );
      return response.data.data;
    },

    async getRule(id: string): Promise<AlertRuleDto> {
      const response = await client.get<ApiSuccessEnvelope<AlertRuleDto>>(API_ENDPOINTS.alertRules.byId(id));
      return response.data.data;
    },

    async updateRule(id: string, input: UpdateAlertRuleInput): Promise<AlertRuleDto> {
      const response = await client.patch<ApiSuccessEnvelope<AlertRuleDto>>(
        API_ENDPOINTS.alertRules.byId(id),
        input,
      );
      return response.data.data;
    },
  };
}

export const alertService = createAlertService(apiClient);
