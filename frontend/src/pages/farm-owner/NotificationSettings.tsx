import { useCallback, useEffect, useRef, useState } from "react";
import { Bell, CheckCheck, RefreshCw } from "lucide-react";

import { Button } from "../../components/common/Button.tsx";
import PageHeader from "../../components/layout/PageHeader.tsx";
import { notificationService } from "../../services/notificationService.ts";
import type { NotificationDto } from "../../types/notification.ts";
import { appendNotificationItems, applyNotificationErrorState } from "./notificationInboxPagination.ts";
import styles from "./NotificationInbox.module.css";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function eventLabel(eventType: NotificationDto["eventType"]) {
  switch (eventType) {
    case "OPENED":
      return "Alert opened";
    case "ACKNOWLEDGED":
      return "Alert acknowledged";
    case "RESOLVED":
      return "Alert resolved";
    default:
      return eventType;
  }
}

function fieldLabel(field: string) {
  switch (field.toUpperCase()) {
    case "MOISTURE":
      return "Soil Moisture";
    case "TEMPERATURE":
      return "Soil Temperature";
    case "PH":
      return "pH Level";
    case "EC":
      return "Electrical Conductivity";
    case "NITROGEN":
      return "Nitrogen (N)";
    case "PHOSPHORUS":
      return "Phosphorus (P)";
    case "POTASSIUM":
      return "Potassium (K)";
    default:
      return field;
  }
}

function statusLabel(status: string) {
  switch (status.toUpperCase()) {
    case "OPEN":
      return "Open";
    case "ACKNOWLEDGED":
      return "Acknowledged";
    case "RESOLVED":
      return "Resolved";
    default:
      return status;
  }
}

export default function NotificationSettings() {
  const [items, setItems] = useState<NotificationDto[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [showUnread, setShowUnread] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [updatingId, setUpdatingId] = useState("");
  const [error, setError] = useState("");
  const requestGeneration = useRef(0);
  const lastFilter = useRef(showUnread);
  const stateRef = useRef({ items, unreadCount, nextCursor });
  useEffect(() => {
    stateRef.current = { items, unreadCount, nextCursor };
  }, [items, unreadCount, nextCursor]);

  const purgeAccess = useCallback(() => {
    requestGeneration.current += 1;
    stateRef.current = { items: [], unreadCount: 0, nextCursor: null };
    setItems([]);
    setUnreadCount(0);
    setNextCursor(null);
    setLoading(false);
    setLoadingMore(false);
    setUpdatingId("");
  }, []);

  const load = useCallback(async () => {
    const generation = ++requestGeneration.current;
    if (lastFilter.current !== showUnread) {
      lastFilter.current = showUnread;
      setItems([]);
      setNextCursor(null);
    }
    setLoading(true);
    setLoadingMore(false);
    setError("");
    try {
      const page = await notificationService.list({ isRead: showUnread ? false : undefined, limit: 100 });
      if (generation !== requestGeneration.current) return;
      setItems(page.items);
      setUnreadCount(page.unreadCount);
      setNextCursor(page.nextCursor);
    } catch (reason) {
      if (generation !== requestGeneration.current) return;
      const res = applyNotificationErrorState(reason, stateRef.current);
      setError(res.error);
      if (res.accessLost) purgeAccess();
    } finally {
      if (generation === requestGeneration.current) setLoading(false);
    }
  }, [showUnread, purgeAccess]);

  useEffect(() => {
    let active = true;
    void Promise.resolve().then(() => {
      if (active) return load();
    });
    return () => {
      active = false;
      requestGeneration.current += 1;
    };
  }, [load]);

  async function loadMore() {
    if (!nextCursor || loading || loadingMore) return;
    const generation = requestGeneration.current;
    setLoadingMore(true);
    setError("");
    try {
      const page = await notificationService.list({
        isRead: showUnread ? false : undefined,
        limit: 100,
        cursor: nextCursor,
      });
      if (generation !== requestGeneration.current) return;
      setItems((current) => appendNotificationItems(current, page.items));
      setUnreadCount(page.unreadCount);
      setNextCursor(page.nextCursor);
    } catch (reason) {
      if (generation !== requestGeneration.current) return;
      const res = applyNotificationErrorState(reason, stateRef.current);
      setError(res.error);
      if (res.accessLost) purgeAccess();
    } finally {
      setLoadingMore(false);
    }
  }

  async function toggleRead(item: NotificationDto) {
    const generation = requestGeneration.current;
    setUpdatingId(item.id);
    setError("");
    try {
      const updated = await notificationService.setRead(item.id, !item.isRead);
      if (generation !== requestGeneration.current) return;
      if (showUnread && updated.isRead) setItems((current) => current.filter(({ id }) => id !== updated.id));
      else setItems((current) => current.map((entry) => entry.id === updated.id ? updated : entry));
      setUnreadCount((count) => Math.max(0, count + (updated.isRead ? -1 : 1)));
    } catch (reason) {
      if (generation !== requestGeneration.current) return;
      const res = applyNotificationErrorState(reason, stateRef.current);
      setError(res.error);
      if (res.accessLost) purgeAccess();
    } finally {
      setUpdatingId("");
    }
  }

  return (
    <div className={styles.page}>
      <PageHeader
        title="Notifications"
        description="In-app alert notifications delivered for your authorized farms."
        actions={
          <Button
            variant="outline"
            icon={<RefreshCw size={16} />}
            loading={loading}
            onClick={() => {
              void load();
            }}
          >
            Refresh
          </Button>
        }
      />
      <div className={styles.toolbar}>
        <button
          type="button"
          className={!showUnread ? styles.active : ""}
          aria-pressed={!showUnread}
          disabled={loading}
          onClick={() => setShowUnread(false)}
        >
          All
        </button>
        <button
          type="button"
          className={showUnread ? styles.active : ""}
          aria-pressed={showUnread}
          disabled={loading}
          onClick={() => setShowUnread(true)}
        >
          Unread <span>{unreadCount}</span>
        </button>
      </div>
      {error && items.length > 0 && <p className={styles.error} role="alert">{error}</p>}
      <section className={styles.inbox}>
        {loading ? (
          <p className={styles.empty}>Loading notifications…</p>
        ) : error && items.length === 0 ? (
          <div className={styles.emptyInbox} role="alert">
            <Bell size={32} className={styles.emptyIcon} aria-hidden="true" />
            <h3>Unable to load notifications</h3>
            <p>{error}. Please click Refresh to try loading notifications again.</p>
          </div>
        ) : items.length === 0 ? (
          <div className={styles.emptyInbox} role="status">
            <Bell size={32} className={styles.emptyIcon} aria-hidden="true" />
            <h3>{showUnread ? "No unread notifications" : "Inbox is empty"}</h3>
            <p>
              {showUnread
                ? "You have caught up with all alert notifications."
                : "There are currently no alert notifications for your authorized stations."}
            </p>
          </div>
        ) : (
          items.map((item) => (
            <article key={item.id} className={`${styles.item} ${item.isRead ? "" : styles.unread}`}>
              <span className={styles.icon} aria-hidden="true"><Bell size={18} /></span>
              <div className={styles.content}>
                <div className={styles.heading}>
                  <strong>{eventLabel(item.eventType)}: {fieldLabel(item.field)} · {item.station.code}</strong>
                  <span className={item.severity === "CRITICAL" ? styles.critical : styles.warning}>
                    {item.severity === "CRITICAL" ? "Critical Alert" : "Warning Alert"}
                  </span>
                  <span className={`${styles.readStateBadge} ${item.isRead ? styles.readState : styles.unreadState}`}>
                    {item.isRead ? "Read" : "Unread"}
                  </span>
                </div>
                <p>{item.station.name} · Alert status: {statusLabel(item.alertStatus)}</p>
                <time dateTime={item.createdAt}>{formatDate(item.createdAt)}</time>
              </div>
              <Button
                size="sm"
                variant="ghost"
                icon={<CheckCheck size={16} />}
                loading={updatingId === item.id}
                onClick={() => void toggleRead(item)}
              >
                {item.isRead ? "Mark unread" : "Mark read"}
              </Button>
            </article>
          ))
        )}
      </section>
      {!loading && nextCursor && (
        <div className={styles.pagination}>
          <Button variant="outline" loading={loadingMore} onClick={() => { void loadMore(); }}>
            Load more notifications
          </Button>
        </div>
      )}
      <p className={styles.note}>Alert notifications are delivered in-app for authorized farms and stations.</p>
    </div>
  );
}
