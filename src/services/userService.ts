import { apiClient } from "@/api/apiClient";
import { API_ENDPOINTS } from "@/api/endpoints";

import type { User } from "@/types/user";
import type { PaginatedResponse } from "@/types/api";

export interface UserQueryParams {
  page?: number;
  limit?: number;

  search?: string;
  role?: string;
  status?: string;

  farmId?: string;
  plotId?: string;
}

export type CreateUserRequest = Omit<
  User,
  "id" | "createdAt" | "updatedAt"
>;

export type UpdateUserRequest = Partial<CreateUserRequest>;

export const userService = {
  async getUsers(
    params?: UserQueryParams
  ): Promise<PaginatedResponse<User>> {
    const response = await apiClient.get<
      PaginatedResponse<User>
    >(
      API_ENDPOINTS.users.base,
      { params }
    );

    return response.data;
  },

  async getUserById(id: string): Promise<User> {
    const response = await apiClient.get<User>(
      API_ENDPOINTS.users.byId(id)
    );

    return response.data;
  },

  async createUser(
    payload: CreateUserRequest
  ): Promise<User> {
    const response = await apiClient.post<User>(
      API_ENDPOINTS.users.base,
      payload
    );

    return response.data;
  },

  async updateUser(
    id: string,
    payload: UpdateUserRequest
  ): Promise<User> {
    const response = await apiClient.put<User>(
      API_ENDPOINTS.users.byId(id),
      payload
    );

    return response.data;
  },

  async deleteUser(id: string): Promise<void> {
    await apiClient.delete(
      API_ENDPOINTS.users.byId(id)
    );
  },
};