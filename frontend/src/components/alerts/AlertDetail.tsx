import {
  Check,
  MessageSquare,
  UserRound,
  X,
} from "lucide-react";
import type { Alert } from "@/types/alert";
import AlertBadge from "./AlertBadge";
import AlertTimeline from "./AlertTimeline";
import styles from "./AlertDetail.module.css";

interface AlertDetailProps {
  alert: Alert;

  onClose?: () => void;
  onAcknowledge?: (alert: Alert) => void;
  onAssign?: (alert: Alert) => void;
  onComment?: (alert: Alert) => void;
  onResolve?: (alert: Alert) => void;
}

const ALERT_TYPE_LABELS: Record<Alert["type"], string> = {
  soil_moisture: "Soil Moisture",
  temperature: "Temperature",
  ph: "pH",
  ec: "EC",
  npk: "NPK",
  offline: "Offline",
  low_battery: "Low Battery",
  sensor_error: "Sensor Error",
  signal_loss: "Signal Loss",
  stale_data: "Stale Data",
  calibration_expired: "Calibration Expired",
};

function formatDateTime(value?: string): string {
  if (!value) {
    return "—";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function formatValue(
  value?: number,
  unit?: string,
): string {
  if (value === undefined || value === null) {
    return "—";
  }

  return `${value}${unit ? ` ${unit}` : ""}`;
}

function formatDuration(seconds?: number): string {
  if (seconds === undefined || seconds === null) {
    return "—";
  }

  const totalMinutes = Math.floor(seconds / 60);

  if (totalMinutes < 60) {
    return `${totalMinutes} minutes`;
  }

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  return minutes
    ? `${hours}h ${minutes}m`
    : `${hours}h`;
}

export default function AlertDetail({
  alert,
  onClose,
  onAcknowledge,
  onAssign,
  onComment,
  onResolve,
}: AlertDetailProps) {
  const canAcknowledge =
    alert.status === "open";

  const canAssign =
    alert.status !== "resolved";

  const canComment =
    alert.status !== "resolved";

  const canResolve =
    alert.status !== "resolved";

  return (
    <div className={styles.detail}>
      <header className={styles.header}>
        <div className={styles.headerContent}>
          <div className={styles.badges}>
            <AlertBadge
              value={alert.severity}
              variant="severity"
            />

            <AlertBadge
              value={alert.status}
              variant="status"
            />
          </div>

          <h2 className={styles.title}>
            {alert.title}
          </h2>

          <p className={styles.description}>
            {alert.description ??
              "No description available."}
          </p>
        </div>

        {onClose && (
          <button
            type="button"
            className={styles.closeButton}
            onClick={onClose}
            aria-label="Close alert details"
          >
            <X size={18} />
          </button>
        )}
      </header>

      <div className={styles.content}>
        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <h3>Alert Information</h3>
          </div>

          <div className={styles.infoGrid}>
            <InfoItem
              label="Alert Type"
              value={ALERT_TYPE_LABELS[alert.type]}
            />

            <InfoItem
              label="Triggered At"
              value={formatDateTime(
                alert.triggeredAt,
              )}
            />

            <InfoItem
              label="Duration"
              value={formatDuration(
                alert.duration,
              )}
            />

            <InfoItem
              label="Current Value"
              value={formatValue(
                alert.currentValue,
                alert.unit,
              )}
              emphasized
            />

            <InfoItem
              label="Threshold"
              value={formatValue(
                alert.threshold,
                alert.unit,
              )}
            />

            <InfoItem
              label="Metric"
              value={alert.metric ?? "—"}
            />
          </div>
        </section>

        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <h3>Station Information</h3>
          </div>

          <div className={styles.infoGrid}>
            <InfoItem
              label="Farm"
              value={alert.farmId ?? "—"}
              mono
            />

            <InfoItem
              label="Plot"
              value={alert.plotId ?? "—"}
              mono
            />

            <InfoItem
              label="Station"
              value={alert.stationId ?? "—"}
              mono
            />

            <InfoItem
              label="Sensor"
              value={alert.sensorId ?? "—"}
              mono
            />
          </div>
        </section>

        {alert.assignedTo && (
          <section className={styles.section}>
            <div className={styles.sectionHeader}>
              <h3>Assignment</h3>
            </div>

            <InfoItem
              label="Assigned To"
              value={alert.assignedTo}
              mono
            />
          </section>
        )}

        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <h3>Timeline</h3>
          </div>

          <AlertTimeline
            events={alert.timeline ?? []}
          />
        </section>

        {alert.comments &&
          alert.comments.length > 0 && (
            <section className={styles.section}>
              <div className={styles.sectionHeader}>
                <h3>Comments</h3>
              </div>

              <div className={styles.comments}>
                {alert.comments.map((comment) => (
                  <article
                    key={comment.id}
                    className={styles.comment}
                  >
                    <div
                      className={
                        styles.commentHeader
                      }
                    >
                      <span
                        className={
                          styles.commentAuthor
                        }
                      >
                        {comment.userId}
                      </span>

                      <time
                        dateTime={comment.createdAt}
                        className={
                          styles.commentDate
                        }
                      >
                        {formatDateTime(
                          comment.createdAt,
                        )}
                      </time>
                    </div>

                    <p
                      className={
                        styles.commentContent
                      }
                    >
                      {comment.content}
                    </p>
                  </article>
                ))}
              </div>
            </section>
          )}
      </div>

      <footer className={styles.footer}>
        {canAcknowledge && onAcknowledge && (
          <button
            type="button"
            className={`${styles.actionButton} ${styles.secondaryAction}`}
            onClick={() => onAcknowledge(alert)}
          >
            <Check size={16} />
            Acknowledge
          </button>
        )}

        {canAssign && onAssign && (
          <button
            type="button"
            className={`${styles.actionButton} ${styles.secondaryAction}`}
            onClick={() => onAssign(alert)}
          >
            <UserRound size={16} />
            Assign
          </button>
        )}

        {canComment && onComment && (
          <button
            type="button"
            className={`${styles.actionButton} ${styles.secondaryAction}`}
            onClick={() => onComment(alert)}
          >
            <MessageSquare size={16} />
            Add Comment
          </button>
        )}

        {canResolve && onResolve && (
          <button
            type="button"
            className={`${styles.actionButton} ${styles.primaryAction}`}
            onClick={() => onResolve(alert)}
          >
            <Check size={16} />
            Resolve
          </button>
        )}
      </footer>
    </div>
  );
}

interface InfoItemProps {
  label: string;
  value: string;
  mono?: boolean;
  emphasized?: boolean;
}

function InfoItem({
  label,
  value,
  mono = false,
  emphasized = false,
}: InfoItemProps) {
  return (
    <div className={styles.infoItem}>
      <span className={styles.infoLabel}>
        {label}
      </span>

      <span
        className={[
          styles.infoValue,
          mono ? styles.mono : "",
          emphasized ? styles.emphasized : "",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        {value}
      </span>
    </div>
  );
}