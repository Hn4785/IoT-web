import { apiClient } from "@/api/apiClient";
import { API_ENDPOINTS } from "@/api/endpoints";

import type {
  Alert,
  AlertSeverity,
  AlertStatus,
  AlertType,
} from "@/types/alert";

import type { PaginatedResponse } from "@/types/api";

export interface AlertQueryParams {
  page?: number;
  limit?: number;

  farmId?: string;
  plotId?: string;
  stationId?: string;
  sensorId?: string;

  type?: AlertType;
  severity?: AlertSeverity;
  status?: AlertStatus;
}

export interface UpdateAlertRequest {
  status?: AlertStatus;

  assignedTo?: string;

  acknowledgedBy?: string;

  resolvedBy?: string;
}

export interface AddAlertCommentRequest {
  content: string;
}

export const alertService = {
  async getAlerts(
    params?: AlertQueryParams
  ): Promise<PaginatedResponse<Alert>> {
    const response = await apiClient.get<
      PaginatedResponse<Alert>
    >(
      API_ENDPOINTS.alerts.base,
      { params }
    );

    return response.data;
  },

  async getAlertById(id: string): Promise<Alert> {
    const response = await apiClient.get<Alert>(
      API_ENDPOINTS.alerts.byId(id)
    );

    return response.data;
  },

  async updateAlert(
    id: string,
    payload: UpdateAlertRequest
  ): Promise<Alert> {
    const response = await apiClient.patch<Alert>(
      API_ENDPOINTS.alerts.byId(id),
      payload
    );

    return response.data;
  },

  async acknowledgeAlert(
    id: string
  ): Promise<Alert> {
    const response = await apiClient.patch<Alert>(
      API_ENDPOINTS.alerts.byId(id),
      {
        status: "acknowledged",
      }
    );

    return response.data;
  },

  async resolveAlert(
    id: string
  ): Promise<Alert> {
    const response = await apiClient.patch<Alert>(
      API_ENDPOINTS.alerts.byId(id),
      {
        status: "resolved",
      }
    );

    return response.data;
  },

  async addComment(
    id: string,
    payload: AddAlertCommentRequest
  ): Promise<Alert> {
    const response = await apiClient.post<Alert>(
      `${API_ENDPOINTS.alerts.byId(id)}/comments`,
      payload
    );

    return response.data;
  },
};