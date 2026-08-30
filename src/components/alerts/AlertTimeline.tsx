import {
  Check,
  MessageSquare,
  UserRound,
  Zap,
} from "lucide-react";
import type { AlertTimelineEvent } from "@/types/alert";
import styles from "./AlertTimeline.module.css";

interface AlertTimelineProps {
  events: AlertTimelineEvent[];
  emptyMessage?: string;
}

function formatDateTime(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Unknown date";
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function getEventIcon(
  action: AlertTimelineEvent["action"],
) {
  switch (action) {
    case "acknowledge":
      return Check;

    case "assign":
      return UserRound;

    case "comment":
      return MessageSquare;

    case "resolve":
      return Check;

    case "triggered":
    default:
      return Zap;
  }
}

function getEventLabel(
  action: AlertTimelineEvent["action"],
): string {
  switch (action) {
    case "acknowledge":
      return "Acknowledged";

    case "assign":
      return "Assigned";

    case "comment":
      return "Comment Added";

    case "resolve":
      return "Resolved";

    case "triggered":
      return "Alert Triggered";

    default:
      return action;
  }
}

export default function AlertTimeline({
  events,
  emptyMessage = "No timeline events yet.",
}: AlertTimelineProps) {
  if (events.length === 0) {
    return (
      <div className={styles.empty}>
        {emptyMessage}
      </div>
    );
  }

  const sortedEvents = [...events].sort(
    (a, b) =>
      new Date(a.createdAt).getTime() -
      new Date(b.createdAt).getTime(),
  );

  return (
    <ol className={styles.timeline}>
      {sortedEvents.map((event, index) => {
        const Icon = getEventIcon(event.action);
        const isLast =
          index === sortedEvents.length - 1;

        return (
          <li
            key={event.id}
            className={styles.item}
          >
            {!isLast && (
              <span
                className={styles.connector}
                aria-hidden="true"
              />
            )}

            <div className={styles.iconWrapper}>
              <Icon
                size={14}
                strokeWidth={2}
                aria-hidden="true"
              />
            </div>

            <div className={styles.content}>
              <div className={styles.header}>
                <span className={styles.action}>
                  {getEventLabel(event.action)}
                </span>

                <time
                  dateTime={event.createdAt}
                  className={styles.date}
                >
                  {formatDateTime(event.createdAt)}
                </time>
              </div>

              <p className={styles.description}>
                {event.description}
              </p>

              {event.userId && (
                <span className={styles.user}>
                  by {event.userId}
                </span>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}