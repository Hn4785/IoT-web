import type { AlertSeverity, AlertStatus, SoilAlertField } from "./alertApi.ts";

export interface NotificationDto {
  id: string;
  alertId: string;
  eventType: "OPENED" | "ACKNOWLEDGED" | "RESOLVED";
  station: { id: string; code: string; name: string };
  field: SoilAlertField;
  severity: AlertSeverity;
  alertStatus: AlertStatus;
  isRead: boolean;
  createdAt: string;
  readAt: string | null;
}

export interface NotificationPage {
  items: NotificationDto[];
  nextCursor: string | null;
  unreadCount: number;
}

export interface NotificationQuery {
  isRead?: boolean;
  limit?: number;
  cursor?: string;
}
