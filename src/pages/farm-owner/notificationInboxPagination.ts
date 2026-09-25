import type { NotificationDto } from "../../types/notification.ts";

export function appendNotificationItems(
  current: NotificationDto[],
  older: NotificationDto[],
): NotificationDto[] {
  const seen = new Set(current.map(({ id }) => id));
  return [...current, ...older.filter(({ id }) => {
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  })];
}
