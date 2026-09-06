import { apiClient } from "@/api/apiClient";
import { API_ENDPOINTS } from "@/api/endpoints";

import type { User } from "@/types/user";
import { unwrapApiResponse } from "@/types/api";
import type { ApiSuccessEnvelope, CursorPage } from "@/types/api";
import type { UserRole, UserStatus } from "@/types/user";

export interface UserQueryParams {
  cursor?: string;
  limit?: number;
}

export interface CreateUserRequest {
  email: string;
  displayName: string;
  role: UserRole;
}

export interface UpdateUserRequest {
  displayName?: string;
  role?: UserRole;
  status?: UserStatus;
}

export interface ProvisionedUser {
  user: User;
  temporaryPassword: string;
}

export const userService = {
  async getUsers(
    params?: UserQueryParams
  ): Promise<CursorPage<User>> {
    const response = await apiClient.get<
      ApiSuccessEnvelope<CursorPage<User>>
    >(
      API_ENDPOINTS.users.base,
      { params }
    );

    return unwrapApiResponse(response.data);
  },

  async getUserById(id: string): Promise<User> {
    const response = await apiClient.get<ApiSuccessEnvelope<User>>(
      API_ENDPOINTS.users.byId(id)
    );

    return unwrapApiResponse(response.data);
  },

  async createUser(
    payload: CreateUserRequest
  ): Promise<ProvisionedUser> {
    const response = await apiClient.post<ApiSuccessEnvelope<ProvisionedUser>>(
      API_ENDPOINTS.users.base,
      payload
    );

    return unwrapApiResponse(response.data);
  },

  async updateUser(
    id: string,
    payload: UpdateUserRequest
  ): Promise<User> {
    const response = await apiClient.patch<ApiSuccessEnvelope<User>>(
      API_ENDPOINTS.users.byId(id),
      payload
    );

    return unwrapApiResponse(response.data);
  },

  async resetPassword(id: string): Promise<ProvisionedUser> {
    const response = await apiClient.post<ApiSuccessEnvelope<ProvisionedUser>>(
      API_ENDPOINTS.users.resetPassword(id),
    );
    return unwrapApiResponse(response.data);
  },
};
