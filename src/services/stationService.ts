import { apiClient } from "@/api/apiClient";
import { API_ENDPOINTS } from "@/api/endpoints";

import type { Station } from "@/types/station";
import type { PaginatedResponse } from "@/types/api";

export interface StationQueryParams {
  page?: number;
  limit?: number;
  search?: string;
  farmId?: string;
  plotId?: string;
  status?: string;
}

export interface CreateStationRequest {
  name: string;
  farmId: string;
  plotId: string;
  gatewayId?: string;
}

export interface UpdateStationRequest {
  name?: string;
  farmId?: string;
  plotId?: string;
  gatewayId?: string;
  status?: string;
}

export const stationService = {
  async getStations(
    params?: StationQueryParams
  ): Promise<PaginatedResponse<Station>> {
    const response = await apiClient.get<
      PaginatedResponse<Station>
    >(
      API_ENDPOINTS.stations.base,
      { params }
    );

    return response.data;
  },

  async getStationById(id: string): Promise<Station> {
    const response = await apiClient.get<Station>(
      API_ENDPOINTS.stations.byId(id)
    );

    return response.data;
  },

  async createStation(
    payload: CreateStationRequest
  ): Promise<Station> {
    const response = await apiClient.post<Station>(
      API_ENDPOINTS.stations.base,
      payload
    );

    return response.data;
  },

  async updateStation(
    id: string,
    payload: UpdateStationRequest
  ): Promise<Station> {
    const response = await apiClient.put<Station>(
      API_ENDPOINTS.stations.byId(id),
      payload
    );

    return response.data;
  },

  async deleteStation(id: string): Promise<void> {
    await apiClient.delete(
      API_ENDPOINTS.stations.byId(id)
    );
  },
};