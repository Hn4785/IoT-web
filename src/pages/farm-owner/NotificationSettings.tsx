import { useCallback, useEffect, useState } from "react";
import { Bell, CheckCheck, RefreshCw } from "lucide-react";

import { Button } from "../../components/common/Button.tsx";
import PageHeader from "../../components/layout/PageHeader.tsx";
import { notificationService } from "../../services/notificationService.ts";
import type { NotificationDto } from "../../types/notification.ts";
import { normalizeApiError } from "../../utils/apiError.ts";
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
  const [showUnread, setShowUnread] = useState(false);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const page = await notificationService.list({ isRead: showUnread ? false : undefined, limit: 100 });
      setItems(page.items);
      setUnreadCount(page.unreadCount);
    } catch (reason) {
      setError(normalizeApiError(reason).message);
    } finally {
      setLoading(false);
    }
  }, [showUnread]);

  useEffect(() => {
    let active = true;
    notificationService.list({ isRead: showUnread ? false : undefined, limit: 100 }).then(
      (page) => {
        if (!active) return;
        setItems(page.items);
        setUnreadCount(page.unreadCount);
        setLoading(false);
      },
      (reason) => {
        if (!active) return;
        setError(normalizeApiError(reason).message);
        setLoading(false);
      },
    );
    return () => { active = false; };
  }, [showUnread]);

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
          setLoading(true);
          setError("");
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
      <p className={styles.note}>Email and SMS are not enabled in this release; this page reflects the backend in-app notification contract.</p>
    </div>
  );
}
