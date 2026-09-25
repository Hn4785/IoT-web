import type { NotificationDto } from "../../types/notification.ts";

const eventTitles: Record<NotificationDto["eventType"], string> = {
  OPENED: "Alert opened",
  ACKNOWLEDGED: "Alert acknowledged",
  RESOLVED: "Alert resolved",
};

export function toNotificationView(notification: NotificationDto) {
  return {
    id: notification.id,
    alertId: notification.alertId,
    title: `${eventTitles[notification.eventType]} · ${notification.station.code}`,
    message: `${notification.field} at ${notification.station.name}`,
    stationCode: notification.station.code,
    severity: notification.severity.toLowerCase() as "warning" | "critical",
    createdAt: notification.createdAt,
    isRead: notification.isRead,
  };
}
