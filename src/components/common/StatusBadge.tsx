import type { StationStatus } from "@/types/station";
import type { GatewayStatus, CredentialStatus } from "@/types/gateway";
import type { SensorStatus, CalibrationStatus } from "@/types/sensor";
import type { AlertSeverity, AlertStatus } from "@/types/alert";
import styles from "./StatusBadge.module.css";

export type StatusBadgeValue =
  | StationStatus
  | GatewayStatus
  | CredentialStatus
  | SensorStatus
  | CalibrationStatus
  | AlertSeverity
  | AlertStatus;

export type StatusBadgeSize = "sm" | "md";

type StatusColor = "success" | "neutral" | "warning" | "danger" | "info" | "purple";

export interface StatusBadgeProps {
  /** Any status value from Station, Gateway, Sensor, Credential, Calibration, or Alert domains. */
  status: StatusBadgeValue;
  /** Overrides the auto-generated label (e.g. custom copy). Defaults to a humanized version of `status`. */
  label?: string;
  size?: StatusBadgeSize;
  /** Shows the leading color dot. Defaults to true. */
  dot?: boolean;
  className?: string;
}

/**
 * Maps every status value used across the app to a consistent color +
 * label. Add new statuses here as new domains are introduced so every
 * badge stays visually consistent.
 */
const STATUS_CONFIG: Record<string, { label: string; color: StatusColor }> = {
  // Station / Gateway
  online: { label: "Online", color: "success" },
  offline: { label: "Offline", color: "neutral" },
  stale: { label: "Stale", color: "warning" },
  maintenance: { label: "Maintenance", color: "info" },
  disabled: { label: "Disabled", color: "neutral" },

  // Sensor
  active: { label: "Active", color: "success" },
  inactive: { label: "Inactive", color: "neutral" },
  error: { label: "Error", color: "danger" },
  uncalibrated: { label: "Uncalibrated", color: "warning" },

  // Calibration
  valid: { label: "Valid", color: "success" },
  expired: { label: "Expired", color: "danger" },

  // Credential
  revoked: { label: "Revoked", color: "danger" },
  rotation_required: { label: "Rotation required", color: "warning" },

  // Alert severity
  warning: { label: "Warning", color: "warning" },
  critical: { label: "Critical", color: "danger" },

  // Alert status
  open: { label: "Open", color: "danger" },
  acknowledged: { label: "Acknowledged", color: "info" },
  assigned: { label: "Assigned", color: "purple" },
  resolved: { label: "Resolved", color: "success" },
};

const FALLBACK_CONFIG = { label: "Unknown", color: "neutral" as StatusColor };

function humanize(value: string): string {
  const words = value.split("_");
  return words[0].charAt(0).toUpperCase() + words[0].slice(1) + (words.length > 1 ? " " + words.slice(1).join(" ") : "");
}

/**
 * @example
 * <StatusBadge status={station.status} />
 * <StatusBadge status={alert.severity} size="sm" />
 * <StatusBadge status="unknown_value" label="Custom label" />
 */
export function StatusBadge({
  status,
  label,
  size = "md",
  dot = true,
  className,
}: StatusBadgeProps) {
  const config = STATUS_CONFIG[status] ?? FALLBACK_CONFIG;
  const displayLabel = label ?? config.label ?? humanize(status);

  const classNames = [styles.badge, styles[config.color], styles[size], className ?? ""]
    .filter(Boolean)
    .join(" ");

  return (
    <span className={classNames}>
      {dot && <span className={styles.dot} aria-hidden="true" />}
      {displayLabel}
    </span>
  );
}

export default StatusBadge;