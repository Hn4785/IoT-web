import { AlertCircle, CheckCircle2, Clock3, ShieldAlert } from "lucide-react";
import type { AlertSeverity, AlertStatus } from "@/types/alert";
import styles from "./AlertBadge.module.css";

type AlertBadgeVariant = "severity" | "status";

interface AlertBadgeProps {
  value: AlertSeverity | AlertStatus;
  variant?: AlertBadgeVariant;
  size?: "sm" | "md";
  showIcon?: boolean;
  className?: string;
}

const SEVERITY_CONFIG: Record<
  AlertSeverity,
  {
    label: string;
    className: string;
  }
> = {
  warning: {
    label: "Warning",
    className: styles.warning,
  },
  critical: {
    label: "Critical",
    className: styles.critical,
  },
};

const STATUS_CONFIG: Record<
  AlertStatus,
  {
    label: string;
    className: string;
  }
> = {
  open: {
    label: "Open",
    className: styles.open,
  },
  acknowledged: {
    label: "Acknowledged",
    className: styles.acknowledged,
  },
  assigned: {
    label: "Assigned",
    className: styles.assigned,
  },
  resolved: {
    label: "Resolved",
    className: styles.resolved,
  },
};

function getIcon(
  variant: AlertBadgeVariant,
  value: AlertSeverity | AlertStatus,
) {
  if (variant === "severity") {
    return value === "critical" ? ShieldAlert : AlertCircle;
  }

  switch (value) {
    case "resolved":
      return CheckCircle2;
    case "acknowledged":
      return Clock3;
    case "assigned":
      return ShieldAlert;
    case "open":
    default:
      return AlertCircle;
  }
}

export default function AlertBadge({
  value,
  variant = "severity",
  size = "md",
  showIcon = true,
  className = "",
}: AlertBadgeProps) {
  const config =
    variant === "severity"
      ? SEVERITY_CONFIG[value as AlertSeverity]
      : STATUS_CONFIG[value as AlertStatus];

  if (!config) {
    return null;
  }

  const Icon = getIcon(variant, value);

  return (
    <span
      className={[
        styles.badge,
        config.className,
        styles[size],
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {showIcon && (
        <Icon
          className={styles.icon}
          size={size === "sm" ? 13 : 14}
          strokeWidth={2}
          aria-hidden="true"
        />
      )}

      <span>{config.label}</span>
    </span>
  );
}