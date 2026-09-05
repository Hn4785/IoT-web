import { apiClient } from "@/api/apiClient";
import { API_ENDPOINTS } from "@/api/endpoints";

import type { Sensor } from "@/types/sensor";
import type { PaginatedResponse } from "@/types/api";

export interface SensorQueryParams {
  page?: number;
  limit?: number;
  stationId?: string;
  status?: string;
  type?: string;
}

export interface CreateSensorRequest {
  name: string;
  stationId: string;
  type: string;
  depth?: number;
}

export interface UpdateSensorRequest {
  name?: string;
  stationId?: string;
  type?: string;
  depth?: number;
  status?: string;
}

export const sensorService = {
  async getSensors(
    params?: SensorQueryParams
  ): Promise<PaginatedResponse<Sensor>> {
    const response = await apiClient.get<
      PaginatedResponse<Sensor>
    >(
      API_ENDPOINTS.sensors.base,
      { params }
    );

    return response.data;
  },

  async getSensorById(id: string): Promise<Sensor> {
    const response = await apiClient.get<Sensor>(
      API_ENDPOINTS.sensors.byId(id)
    );

    return response.data;
  },

  async createSensor(
    payload: CreateSensorRequest
  ): Promise<Sensor> {
    const response = await apiClient.post<Sensor>(
      API_ENDPOINTS.sensors.base,
      payload
    );

    return response.data;
  },

  async updateSensor(
    id: string,
    payload: UpdateSensorRequest
  ): Promise<Sensor> {
    const response = await apiClient.put<Sensor>(
      API_ENDPOINTS.sensors.byId(id),
      payload
    );

    return response.data;
  },

  async deleteSensor(id: string): Promise<void> {
    await apiClient.delete(
      API_ENDPOINTS.sensors.byId(id)
    );
  },
};