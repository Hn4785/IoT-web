import {
  AlertTriangle,
  BatteryLow,
  Check,
  CircleAlert,
  Info,
  WifiOff,
} from "lucide-react";

import type { Notification } from "@/types/notification";

import styles from "./NotificationDropdown.module.css";

interface NotificationDropdownProps {
  notifications: Notification[];
  onMarkAsRead: (id: string) => void;
  onMarkAllAsRead: () => void;
}

const getRelativeTime = (createdAt: string) => {
  const diff = Date.now() - new Date(createdAt).getTime();
  const minutes = Math.floor(diff / (1000 * 60));

  if (minutes < 1) {
    return "Just now";
  }

  if (minutes < 60) {
    return `${minutes} min ago`;
  }

  const hours = Math.floor(minutes / 60);

  if (hours < 24) {
    return `${hours} hr ago`;
  }

  const days = Math.floor(hours / 24);

  return `${days} day${days > 1 ? "s" : ""} ago`;
};

const getNotificationIcon = (notification: Notification) => {
  switch (notification.type) {
    case "offline":
      return <WifiOff size={17} />;

    case "low_battery":
      return <BatteryLow size={17} />;

    case "sensor_error":
      return <CircleAlert size={17} />;

    case "stale_data":
    case "calibration_expired":
      return <AlertTriangle size={17} />;

    case "system":
      return <Info size={17} />;

    default:
      return <CircleAlert size={17} />;
  }
};

export default function NotificationDropdown({
  notifications,
  onMarkAsRead,
  onMarkAllAsRead,
}: NotificationDropdownProps) {
  const unreadCount = notifications.filter(
    (notification) => !notification.read,
  ).length;

  return (
    <div
      className={styles.dropdown}
      role="dialog"
      aria-label="Notifications"
    >
      <div className={styles.header}>
        <div>
          <h3>Notifications</h3>

          {unreadCount > 0 && (
            <span>
              {unreadCount} unread notification
              {unreadCount > 1 ? "s" : ""}
            </span>
          )}
        </div>

        {unreadCount > 0 && (
          <button
            type="button"
            className={styles.markAllButton}
            onClick={onMarkAllAsRead}
          >
            <Check size={14} />
            Mark all as read
          </button>
        )}
      </div>

      <div className={styles.list}>
        {notifications.length === 0 ? (
          <div className={styles.empty}>
            <Info size={22} />
            <strong>No notifications</strong>
            <span>You're all caught up.</span>
          </div>
        ) : (
          notifications.map((notification) => (
            <button
              key={notification.id}
              type="button"
              className={`${styles.item} ${
                !notification.read ? styles.unread : ""
              }`}
              onClick={() => onMarkAsRead(notification.id)}
            >
              <div
                className={`${styles.icon} ${
                  styles[notification.severity]
                }`}
              >
                {getNotificationIcon(notification)}
              </div>

              <div className={styles.content}>
                <div className={styles.itemHeader}>
                  <strong>{notification.title}</strong>

                  {!notification.read && (
                    <span
                      className={styles.unreadDot}
                      aria-label="Unread"
                    />
                  )}
                </div>

                <p>{notification.message}</p>

                <div className={styles.meta}>
                  {notification.stationId && (
                    <span>{notification.stationId}</span>
                  )}

                  {notification.metric &&
                    notification.currentValue !== undefined && (
                      <span>
                        {notification.metric}:{" "}
                        {notification.currentValue}
                        {notification.unit}
                      </span>
                    )}

                  <span>{getRelativeTime(notification.createdAt)}</span>
                </div>
              </div>
            </button>
          ))
        )}
      </div>

      <div className={styles.footer}>
        <button type="button">View all notifications</button>
      </div>
    </div>
  );
}