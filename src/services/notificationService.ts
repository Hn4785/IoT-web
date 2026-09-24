import type { AxiosInstance } from "axios";

import { apiClient } from "../api/apiClient.ts";
import { API_ENDPOINTS } from "../api/endpoints.ts";
import type { ApiSuccessEnvelope } from "../types/api.ts";
import type { NotificationDto, NotificationPage, NotificationQuery } from "../types/notification.ts";

type HttpClient = Pick<AxiosInstance, "get" | "patch">;

export function createNotificationService(client: HttpClient) {
  return {
    async list(params: NotificationQuery = {}): Promise<NotificationPage> {
      const response = await client.get<ApiSuccessEnvelope<NotificationPage>>(
        API_ENDPOINTS.notifications.base,
        { params },
      );
      return response.data.data;
    },

    async setRead(id: string, isRead: boolean): Promise<NotificationDto> {
      const response = await client.patch<ApiSuccessEnvelope<NotificationDto>>(
        API_ENDPOINTS.notifications.byId(id),
        { isRead },
      );
      return response.data.data;
    },
  };
}

export const notificationService = createNotificationService(apiClient);
