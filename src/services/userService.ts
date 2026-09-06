import { apiClient } from "@/api/apiClient";
import { API_ENDPOINTS } from "@/api/endpoints";

import type { User } from "@/types/user";
import { unwrapApiResponse } from "@/types/api";
import type { ApiSuccessEnvelope, CursorPage } from "@/types/api";
import type { UserRole, UserStatus } from "@/types/user";
import { normalizeBackendUser } from "./normalizeBackendUser";
import type { BackendUser } from "./normalizeBackendUser";

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
      ApiSuccessEnvelope<CursorPage<BackendUser>>
    >(
      API_ENDPOINTS.users.base,
      { params }
    );

    const page = unwrapApiResponse(response.data);
    return { ...page, items: page.items.map(normalizeBackendUser) };
  },

  async getUserById(id: string): Promise<User> {
    const response = await apiClient.get<ApiSuccessEnvelope<BackendUser>>(
      API_ENDPOINTS.users.byId(id)
    );

    return normalizeBackendUser(unwrapApiResponse(response.data));
  },

  async createUser(
    payload: CreateUserRequest
  ): Promise<ProvisionedUser> {
    const response = await apiClient.post<
      ApiSuccessEnvelope<{ user: BackendUser; temporaryPassword: string }>
    >(
      API_ENDPOINTS.users.base,
      payload
    );

    const provisioned = unwrapApiResponse(response.data);
    return { ...provisioned, user: normalizeBackendUser(provisioned.user) };
  },

  async updateUser(
    id: string,
    payload: UpdateUserRequest
  ): Promise<User> {
    const response = await apiClient.patch<ApiSuccessEnvelope<BackendUser>>(
      API_ENDPOINTS.users.byId(id),
      payload
    );

    return normalizeBackendUser(unwrapApiResponse(response.data));
  },

  async resetPassword(id: string): Promise<ProvisionedUser> {
    const response = await apiClient.post<
      ApiSuccessEnvelope<{ user: BackendUser; temporaryPassword: string }>
    >(
      API_ENDPOINTS.users.resetPassword(id),
    );
    const provisioned = unwrapApiResponse(response.data);
    return { ...provisioned, user: normalizeBackendUser(provisioned.user) };
  },
};
