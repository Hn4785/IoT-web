import { apiClient } from "@/api/apiClient";
import { API_ENDPOINTS } from "@/api/endpoints";

import { authStorage } from "@/utils/authStorage";

import type { User } from "@/types/user";

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  user: User;

  accessToken?: string;
  refreshToken?: string;
}

export const authService = {
  async login(payload: LoginRequest): Promise<LoginResponse> {
    const response = await apiClient.post<LoginResponse>(
      API_ENDPOINTS.auth.login,
      payload
    );

    const data = response.data;

    if (data.accessToken) {
      authStorage.setAccessToken(data.accessToken);
    }

    if (data.refreshToken) {
      authStorage.setRefreshToken(data.refreshToken);
    }

    return data;
  },

  async logout(): Promise<void> {
    try {
      await apiClient.post(API_ENDPOINTS.auth.logout);
    } finally {
      authStorage.clearTokens();
    }
  },

  async getCurrentUser(): Promise<User> {
    const response = await apiClient.get<User>(
      API_ENDPOINTS.auth.me
    );

    return response.data;
  },

  clearSession(): void {
    authStorage.clearTokens();
  },
};