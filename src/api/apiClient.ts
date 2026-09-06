import axios from "axios";
import type { AxiosError, InternalAxiosRequestConfig } from "axios";

import { env } from "@/config/env";
import { authStorage } from "@/utils/authStorage";
import type { ApiSuccessEnvelope } from "@/types/api";
import { createSingleFlight } from "./refreshCoordinator";

type RetriableRequest = InternalAxiosRequestConfig & { _retry?: boolean };

const refreshClient = axios.create({
  baseURL: env.apiBaseUrl,
  timeout: env.apiTimeout,
  withCredentials: true,
});

const refreshAccessToken = createSingleFlight(async () => {
  const response = await refreshClient.post<
    ApiSuccessEnvelope<{ accessToken: string; expiresIn: number }>
  >("/auth/refresh");
  const token = response.data.data.accessToken;
  authStorage.setAccessToken(token);
  return token;
});

export const apiClient = axios.create({
  baseURL: env.apiBaseUrl,
  timeout: env.apiTimeout,
  withCredentials: true,

  headers: {
    "Content-Type": "application/json",
  },
});

apiClient.interceptors.request.use(
  (config) => {
    const token = authStorage.getAccessToken();

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
  },

  async (error: AxiosError) => {
    const request = error.config as RetriableRequest | undefined;
    const path = request?.url ?? "";
    const isAuthOperation = ["/auth/login", "/auth/refresh", "/auth/logout"].some(
      (endpoint) => path.endsWith(endpoint),
    );

    if (error.response?.status !== 401 || !request || request._retry || isAuthOperation) {
      return Promise.reject(error);
    }

    request._retry = true;
    try {
      const token = await refreshAccessToken();
      request.headers.Authorization = `Bearer ${token}`;
      return apiClient(request);
    } catch (refreshError) {
      authStorage.clearAccessToken();
      return Promise.reject(refreshError);
    }
  }
);

apiClient.interceptors.response.use(
  (response) => {
    return response;
  },

  (error) => {
    return Promise.reject(error);
  }
);
