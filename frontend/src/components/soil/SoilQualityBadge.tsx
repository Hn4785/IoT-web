import type { QualityFlag } from "@/types/soil";
import styles from "./SoilQualityBadge.module.css";

export interface SoilQualityBadgeProps {
  quality: QualityFlag;
  showIcon?: boolean;
  size?: "sm" | "md";
  className?: string;
}

interface QualityConfig {
  label: string;
  description: string;
  icon: string;
  className: string;
}

const QUALITY_CONFIG: Record<QualityFlag, QualityConfig> = {
  good: {
    label: "Good",
    description: "Measurement is valid",
    icon: "✓",
    className: styles.good,
  },
  stale: {
    label: "Stale",
    description: "Measurement may be outdated",
    icon: "◷",
    className: styles.stale,
  },
  out_of_range: {
    label: "Out of Range",
    description: "Value is outside the expected range",
    icon: "!",
    className: styles.outOfRange,
  },
  sensor_error: {
    label: "Sensor Error",
    description: "Sensor reported an error",
    icon: "×",
    className: styles.sensorError,
  },
  uncalibrated: {
    label: "Uncalibrated",
    description: "Sensor calibration is required",
    icon: "!",
    className: styles.uncalibrated,
  },
  test: {
    label: "Test",
    description: "Measurement is test data",
    icon: "T",
    className: styles.test,
  },
  unknown: {
    label: "Unknown",
    description: "Measurement quality is unknown",
    icon: "?",
    className: styles.unknown,
  },
};

export default function SoilQualityBadge({
  quality,
  showIcon = true,
  size = "sm",
  className,
}: SoilQualityBadgeProps) {
  const config = QUALITY_CONFIG[quality];

  const classNames = [
    styles.badge,
    config.className,
    styles[size],
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <span
      className={classNames}
      title={config.description}
      aria-label={`Data quality: ${config.label}`}
    >
      {showIcon && (
        <span className={styles.icon} aria-hidden="true">
          {config.icon}
        </span>
      )}

      <span className={styles.label}>{config.label}</span>
    </span>
  );
}