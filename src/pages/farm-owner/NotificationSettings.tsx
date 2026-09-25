import { useCallback, useEffect, useRef, useState } from "react";
import { Bell, CheckCheck, RefreshCw } from "lucide-react";

import { Button } from "../../components/common/Button.tsx";
import PageHeader from "../../components/layout/PageHeader.tsx";
import { notificationService } from "../../services/notificationService.ts";
import type { NotificationDto } from "../../types/notification.ts";
import { normalizeApiError } from "../../utils/apiError.ts";
import { appendNotificationItems } from "./notificationInboxPagination.ts";
import styles from "./NotificationInbox.module.css";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
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

  const load = useCallback(async () => {
    const generation = ++requestGeneration.current;
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
      if (generation === requestGeneration.current) setError(normalizeApiError(reason).message);
    } finally {
      if (generation === requestGeneration.current) setLoading(false);
    }
  }, [showUnread]);

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
      if (generation === requestGeneration.current) setError(normalizeApiError(reason).message);
    } finally {
      if (generation === requestGeneration.current) setLoadingMore(false);
    }
  }

  async function toggleRead(item: NotificationDto) {
    setUpdatingId(item.id);
    setError("");
    try {
      const updated = await notificationService.setRead(item.id, !item.isRead);
      if (showUnread && updated.isRead) setItems((current) => current.filter(({ id }) => id !== updated.id));
      else setItems((current) => current.map((entry) => entry.id === updated.id ? updated : entry));
      setUnreadCount((count) => Math.max(0, count + (updated.isRead ? -1 : 1)));
    } catch (reason) {
      setError(normalizeApiError(reason).message);
    } finally {
      setUpdatingId("");
    }
  }

  return (
    <div className={styles.page}>
      <PageHeader
        title="Notifications"
        description="In-app alert notifications delivered for your authorized farms."
        actions={<Button variant="outline" icon={<RefreshCw size={16} />} onClick={() => {
          void load();
        }}>Refresh</Button>}
      />
      <div className={styles.toolbar}>
        <button className={!showUnread ? styles.active : ""} onClick={() => setShowUnread(false)}>All</button>
        <button className={showUnread ? styles.active : ""} onClick={() => setShowUnread(true)}>Unread <span>{unreadCount}</span></button>
      </div>
      {error && <p className={styles.error} role="alert">{error}</p>}
      <section className={styles.inbox}>
        {loading ? <p className={styles.empty}>Loading notifications…</p> : items.length === 0 ? (
          <p className={styles.empty}>No notifications in this view.</p>
        ) : items.map((item) => (
          <article key={item.id} className={`${styles.item} ${item.isRead ? "" : styles.unread}`}>
            <span className={styles.icon}><Bell size={18} /></span>
            <div className={styles.content}>
              <div className={styles.heading}>
                <strong>{item.eventType}: {item.field} · {item.station.code}</strong>
                <span className={item.severity === "CRITICAL" ? styles.critical : styles.warning}>{item.severity}</span>
              </div>
              <p>{item.station.name} · alert status {item.alertStatus}</p>
              <time dateTime={item.createdAt}>{formatDate(item.createdAt)}</time>
            </div>
            <Button
              size="sm"
              variant="ghost"
              icon={<CheckCheck size={16} />}
              loading={updatingId === item.id}
              onClick={() => void toggleRead(item)}
            >{item.isRead ? "Mark unread" : "Mark read"}</Button>
          </article>
        ))}
      </section>
      {!loading && nextCursor && (
        <div className={styles.pagination}>
          <Button variant="outline" loading={loadingMore} onClick={() => { void loadMore(); }}>
            Load more notifications
          </Button>
        </div>
      )}
      <p className={styles.note}>Email and SMS are not enabled in this release; this page reflects the backend in-app notification contract.</p>
    </div>
  );
}
