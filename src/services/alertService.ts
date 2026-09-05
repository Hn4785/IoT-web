import { apiClient } from "@/api/apiClient";
import { API_ENDPOINTS } from "@/api/endpoints";

import type { Alert } from "@/types/alert";
import type { PaginatedResponse } from "@/types/api";

export interface AlertQueryParams {
  page?: number;
  limit?: number;
  stationId?: string;
  sensorId?: string;
  severity?: string;
  status?: string;
}

export interface UpdateAlertRequest {
  status?: string;
  assignedTo?: string;
  comment?: string;
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

  async deleteAlert(id: string): Promise<void> {
    await apiClient.delete(
      API_ENDPOINTS.alerts.byId(id)
    );
  },
};