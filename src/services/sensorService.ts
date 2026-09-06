import { apiClient } from "@/api/apiClient";
import { API_ENDPOINTS } from "@/api/endpoints";

import type {
  MeasurementType,
  Sensor,
  SensorCalibration,
  SensorStatus,
} from "@/types/sensor";

import type { PaginatedResponse } from "@/types/api";

export interface SensorQueryParams {
  page?: number;
  limit?: number;

  stationId?: string;

  measurement?: MeasurementType;
  status?: SensorStatus;
}

export interface CreateSensorRequest {
  stationId: string;

  name?: string;
  model: string;

  measurement: MeasurementType;
  field: string;

  depth?: number;
  depthUnit?: "cm" | "m";

  unit: string;

  status?: SensorStatus;

  measurementInterval?: number;
  sendInterval?: number;

  calibration?: SensorCalibration;
}

export interface UpdateSensorRequest {
  name?: string;
  model?: string;

  measurement?: MeasurementType;
  field?: string;

  depth?: number;
  depthUnit?: "cm" | "m";

  unit?: string;

  status?: SensorStatus;

  measurementInterval?: number;
  sendInterval?: number;

  calibration?: SensorCalibration;
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