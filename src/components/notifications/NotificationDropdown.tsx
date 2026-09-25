import { Bell, CircleAlert, Info } from "lucide-react";

import type { NotificationDto } from "../../types/notification.ts";
import { toNotificationView } from "./notificationView.ts";
import styles from "./NotificationDropdown.module.css";

interface NotificationDropdownProps {
  notifications: NotificationDto[];
  unreadCount: number;
  loading: boolean;
  error: string;
  updatingId: string;
  onMarkAsRead: (id: string) => void;
  onRetry: () => void;
  onViewAll?: () => void;
}

function relativeTime(createdAt: string): string {
  const elapsed = Date.now() - new Date(createdAt).getTime();
  if (!Number.isFinite(elapsed)) return "Date unavailable";
  const minutes = Math.max(0, Math.floor(elapsed / 60_000));
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

export default function NotificationDropdown({
  notifications,
  unreadCount,
  loading,
  error,
  updatingId,
  onMarkAsRead,
  onRetry,
  onViewAll,
}: NotificationDropdownProps) {
  return (
    <div className={styles.dropdown} role="dialog" aria-label="Notifications">
      <div className={styles.header}>
        <div>
          <h3>Notifications</h3>
          <span>{unreadCount} unread</span>
        </div>
        <button type="button" className={styles.markAllButton} onClick={onRetry}>
          Refresh
        </button>
      </div>

      <div className={styles.list} aria-live="polite">
        {loading ? (
          <div className={styles.empty}>Loading notifications…</div>
        ) : error ? (
          <div className={styles.empty} role="alert">
            <CircleAlert size={22} />
            <strong>Notifications unavailable</strong>
            <span>{error}</span>
          </div>
        ) : notifications.length === 0 ? (
          <div className={styles.empty}>
            <Info size={22} />
            <strong>No notifications</strong>
            <span>You're all caught up.</span>
          </div>
        ) : (
          notifications.map((item) => {
            const view = toNotificationView(item);
            return (
              <button
                key={view.id}
                type="button"
                className={`${styles.item} ${view.isRead ? "" : styles.unread}`}
                disabled={view.isRead || updatingId === view.id}
                onClick={() => onMarkAsRead(view.id)}
                aria-label={`${view.title}${view.isRead ? "" : ", mark as read"}`}
              >
                <div className={`${styles.icon} ${styles[view.severity]}`}>
                  <Bell size={17} aria-hidden="true" />
                </div>
                <div className={styles.content}>
                  <div className={styles.itemHeader}>
                    <strong>{view.title}</strong>
                    {!view.isRead && <span className={styles.unreadDot} aria-label="Unread" />}
                  </div>
                  <p>{view.message}</p>
                  <div className={styles.meta}>
                    <span>{view.stationCode}</span>
                    <span>{relativeTime(view.createdAt)}</span>
                  </div>
                </div>
              </button>
            );
          })
        )}
      </div>

      {onViewAll && (
        <div className={styles.footer}>
          <button type="button" onClick={onViewAll}>View all notifications</button>
        </div>
      )}
    </div>
  );
}
