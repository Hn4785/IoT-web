import {
  Check,
  Eye,
  MessageSquare,
  UserRound,
} from "lucide-react";
import type { Alert } from "@/types/alert";
import AlertBadge from "./AlertBadge";
import styles from "./AlertTable.module.css";

interface AlertTableProps {
  alerts: Alert[];

  onView?: (alert: Alert) => void;
  onAcknowledge?: (alert: Alert) => void;
  onAssign?: (alert: Alert) => void;
  onComment?: (alert: Alert) => void;
  onResolve?: (alert: Alert) => void;

  emptyMessage?: string;
  showActions?: boolean;
  compact?: boolean;
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

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatValue(
  value?: number,
  unit?: string,
) {
  if (value === undefined) {
    return "—";
  }

  return `${value}${unit ? ` ${unit}` : ""}`;
}

function formatDuration(seconds?: number) {
  if (seconds === undefined || seconds === null) {
    return "—";
  }

  const totalMinutes = Math.floor(seconds / 60);

  if (totalMinutes < 60) {
    return `${totalMinutes} min`;
  }

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  return minutes > 0
    ? `${hours}h ${minutes}m`
    : `${hours}h`;
}

export default function AlertTable({
  alerts,
  onView,
  onAcknowledge,
  onAssign,
  onComment,
  onResolve,
  emptyMessage = "No alerts found.",
  showActions = true,
  compact = false,
}: AlertTableProps) {
  if (alerts.length === 0) {
    return (
      <div className={styles.emptyState}>
        <div className={styles.emptyIcon}>
          <Check size={20} aria-hidden="true" />
        </div>

        <div>
          <p className={styles.emptyTitle}>No alerts</p>
          <p className={styles.emptyMessage}>{emptyMessage}</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className={[
        styles.tableWrapper,
        compact ? styles.compact : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <table className={styles.table}>
        <thead>
          <tr>
            <th>Alert</th>
            <th>Station</th>
            <th>Sensor</th>
            <th>Value</th>
            <th>Triggered At</th>
            <th>Duration</th>
            <th>Status</th>

            {showActions && <th className={styles.actionsHeader}>Actions</th>}
          </tr>
        </thead>

        <tbody>
          {alerts.map((alert) => (
            <tr key={alert.id}>
              <td>
                <button
                  type="button"
                  className={styles.alertButton}
                  onClick={() => onView?.(alert)}
                >
                  <span className={styles.alertTitle}>
                    {alert.title}
                  </span>

                  <span className={styles.alertMeta}>
                    <AlertBadge
                      value={alert.severity}
                      variant="severity"
                      size="sm"
                    />

                    <span>
                      {ALERT_TYPE_LABELS[alert.type]}
                    </span>
                  </span>
                </button>
              </td>

              <td>
                <span className={styles.resourceId}>
                  {alert.stationId ?? "—"}
                </span>
              </td>

              <td>
                <span className={styles.resourceId}>
                  {alert.sensorId ?? "—"}
                </span>
              </td>

              <td>
                <span className={styles.value}>
                  {formatValue(
                    alert.currentValue,
                    alert.unit,
                  )}
                </span>

                {alert.threshold !== undefined && (
                  <span className={styles.threshold}>
                    Threshold: {formatValue(alert.threshold, alert.unit)}
                  </span>
                )}
              </td>

              <td>
                <span className={styles.timestamp}>
                  {formatDateTime(alert.triggeredAt)}
                </span>
              </td>

              <td>
                {formatDuration(alert.duration)}
              </td>

              <td>
                <AlertBadge
                  value={alert.status}
                  variant="status"
                  size="sm"
                />
              </td>

              {showActions && (
                <td>
                  <div className={styles.actions}>
                    {onView && (
                      <button
                        type="button"
                        className={styles.actionButton}
                        onClick={() => onView(alert)}
                        aria-label={`View ${alert.title}`}
                        title="View details"
                      >
                        <Eye size={16} />
                      </button>
                    )}

                    {onAcknowledge &&
                      alert.status === "open" && (
                        <button
                          type="button"
                          className={styles.actionButton}
                          onClick={() => onAcknowledge(alert)}
                          aria-label={`Acknowledge ${alert.title}`}
                          title="Acknowledge"
                        >
                          <Check size={16} />
                        </button>
                      )}

                    {onAssign &&
                      alert.status !== "resolved" && (
                        <button
                          type="button"
                          className={styles.actionButton}
                          onClick={() => onAssign(alert)}
                          aria-label={`Assign ${alert.title}`}
                          title="Assign"
                        >
                          <UserRound size={16} />
                        </button>
                      )}

                    {onComment &&
                      alert.status !== "resolved" && (
                        <button
                          type="button"
                          className={styles.actionButton}
                          onClick={() => onComment(alert)}
                          aria-label={`Comment on ${alert.title}`}
                          title="Add comment"
                        >
                          <MessageSquare size={16} />
                        </button>
                      )}

                    {onResolve &&
                      alert.status !== "resolved" && (
                        <button
                          type="button"
                          className={`${styles.actionButton} ${styles.resolveButton}`}
                          onClick={() => onResolve(alert)}
                          aria-label={`Resolve ${alert.title}`}
                          title="Resolve"
                        >
                          <Check size={16} />
                        </button>
                      )}
                  </div>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}