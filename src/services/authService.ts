import { apiClient } from "@/api/apiClient";
import { API_ENDPOINTS } from "@/api/endpoints";

import { authStorage } from "@/utils/authStorage";
import { unwrapApiResponse } from "@/types/api";

import type { User } from "@/types/user";
import type { ApiSuccessEnvelope } from "@/types/api";

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  user: User;
  accessToken: string;
  expiresIn: number;
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

export const authService = {
  async login(payload: LoginRequest): Promise<LoginResponse> {
    const response = await apiClient.post<ApiSuccessEnvelope<LoginResponse>>(
      API_ENDPOINTS.auth.login,
      payload
    );

    const data = unwrapApiResponse(response.data);
    authStorage.setAccessToken(data.accessToken);

    return data;
  },

  async logout(): Promise<void> {
    try {
      await apiClient.post(API_ENDPOINTS.auth.logout);
    } finally {
      authStorage.clearAccessToken();
    }
  },

  async getCurrentUser(): Promise<User> {
    const response = await apiClient.get<ApiSuccessEnvelope<User>>(
      API_ENDPOINTS.auth.me
    );

    return unwrapApiResponse(response.data);
  },

  async refresh(): Promise<{ accessToken: string; expiresIn: number }> {
    const response = await apiClient.post<
      ApiSuccessEnvelope<{ accessToken: string; expiresIn: number }>
    >(API_ENDPOINTS.auth.refresh);
    const data = unwrapApiResponse(response.data);
    authStorage.setAccessToken(data.accessToken);
    return data;
  },

  async changePassword(payload: ChangePasswordRequest): Promise<User> {
    const response = await apiClient.post<ApiSuccessEnvelope<User>>(
      API_ENDPOINTS.auth.changePassword,
      payload,
    );
    return unwrapApiResponse(response.data);
  },

  clearSession(): void {
    authStorage.clearAccessToken();
  },
};
