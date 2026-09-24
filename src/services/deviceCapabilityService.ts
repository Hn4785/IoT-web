import type { AxiosInstance } from "axios";

import { apiClient } from "../api/apiClient.ts";
import { API_ENDPOINTS } from "../api/endpoints.ts";
import type { ApiSuccessEnvelope } from "../types/api.ts";

export interface DeviceCapability {
  status: "NOT_AVAILABLE";
  reasonCode: "DEVICE_CONTRACT_PENDING";
}

type HttpClient = Pick<AxiosInstance, "get">;

export function createDeviceCapabilityService(client: HttpClient) {
  return {
    async get(): Promise<DeviceCapability> {
      const response = await client.get<ApiSuccessEnvelope<DeviceCapability>>(
        API_ENDPOINTS.deviceConfigurations.capability,
      );
      return response.data.data;
    },
  };
}

export const deviceCapabilityService = createDeviceCapabilityService(apiClient);
