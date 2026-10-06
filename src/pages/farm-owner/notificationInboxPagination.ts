import type { NotificationDto } from "../../types/notification.ts";
import { normalizeApiError } from "../../utils/apiError.ts";

export function appendNotificationItems(
  current: NotificationDto[],
  older: NotificationDto[],
): NotificationDto[] {
  const seen = new Set(current.map((item) => item.id));
  const result = [...current];
  for (const item of older) {
    if (!seen.has(item.id)) {
      seen.add(item.id);
      result.push(item);
    }
  }
  return result;
}

export function isAccessLoss(error: unknown): boolean {
  const status = normalizeApiError(error).status
    ?? (error as { response?: { status?: number } })?.response?.status
    ?? (error as { status?: number })?.status;
  return status === 401 || status === 403 || status === 404;
}

export interface NotificationInboxState {
  items: NotificationDto[];
  unreadCount: number;
  nextCursor: string | null;
}

export interface NotificationErrorResolution {
  items: NotificationDto[];
  unreadCount: number;
  nextCursor: string | null;
  error: string;
  accessLost: boolean;
}

export function applyNotificationErrorState<T extends NotificationInboxState>(
  error: unknown,
  current: T,
): NotificationErrorResolution {
  const message = normalizeApiError(error).message;
  const accessLost = isAccessLoss(error);
  if (accessLost) {
    return { items: [], unreadCount: 0, nextCursor: null, error: message, accessLost: true };
  }
  return {
    items: current.items,
    unreadCount: current.unreadCount,
    nextCursor: current.nextCursor,
    error: message,
    accessLost: false,
  };
}
