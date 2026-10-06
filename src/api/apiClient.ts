import axios from "axios";
import type { AxiosError, InternalAxiosRequestConfig } from "axios";

import { env } from "../config/env.ts";
import { authStorage } from "../utils/authStorage.ts";
import type { ApiSuccessEnvelope } from "../types/api.ts";
import { createSingleFlight } from "./refreshCoordinator.ts";
import {
  getCurrentSessionSnapshot,
  invalidateSession,
} from "../auth/sessionInvalidation.ts";
import type { SessionSnapshot } from "../auth/sessionInvalidation.ts";

type RetriableRequest = InternalAxiosRequestConfig & { _retry?: boolean; _sessionSnapshot?: SessionSnapshot };

const refreshClient = axios.create({
  baseURL: env.apiBaseUrl,
  timeout: env.apiTimeout,
  withCredentials: true,
});

const refreshAccessToken = createSingleFlight(async () => {
  const snapshot = getCurrentSessionSnapshot();
  const response = await refreshClient.post<
    ApiSuccessEnvelope<{ accessToken: string; expiresIn: number }>
  >("/auth/refresh");
  const current = getCurrentSessionSnapshot();
  if (current.epoch !== snapshot.epoch || current.token !== snapshot.token) {
    throw new Error("Obsolete refresh succeeded after session replacement");
  }
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
    (config as RetriableRequest)._sessionSnapshot = getCurrentSessionSnapshot();
    const token = authStorage.getAccessToken();

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
  },
  (error: AxiosError) => Promise.reject(error),
);

apiClient.interceptors.response.use(
  (response) => {
    return response;
  },

  async (error: AxiosError) => {
    const request = error.config as RetriableRequest | undefined;
    const path = request?.url ?? "";
    const isAuthOperation = ["/auth/login", "/auth/refresh", "/auth/logout"].some(
      (endpoint) => path.endsWith(endpoint),
    );

    if (error.response?.status !== 401 || !request || isAuthOperation) {
      return Promise.reject(error);
    }

    if (request._retry) {
      invalidateSession(request._sessionSnapshot);
      return Promise.reject(error);
    }

    const current = getCurrentSessionSnapshot();
    if (request._sessionSnapshot && request._sessionSnapshot.epoch !== current.epoch) {
      return Promise.reject(error);
    }

    request._retry = true;
    if (current.token && request._sessionSnapshot?.token !== current.token) {
      request.headers.Authorization = `Bearer ${current.token}`;
      return apiClient(request);
    }
    const snapshot = getCurrentSessionSnapshot();
    try {
      const token = await refreshAccessToken();
      request.headers.Authorization = `Bearer ${token}`;
      return apiClient(request);
    } catch (refreshError) {
      invalidateSession(snapshot);
      return Promise.reject(refreshError);
    }
  }
);
