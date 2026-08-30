import type {
  StationStatus,
} from "@/types/station";
import type {
  SensorStatus,
} from "@/types/sensor";
import type {
  GatewayStatus,
} from "@/types/gateway";

import styles from "./DeviceStatus.module.css";

type DeviceStatusProps =
  | {
      deviceType: "station";
      status: StationStatus;
      showLabel?: boolean;
    }
  | {
      deviceType: "sensor";
      status: SensorStatus;
      showLabel?: boolean;
    }
  | {
      deviceType: "gateway";
      status: GatewayStatus;
      showLabel?: boolean;
    };

const STATUS_CONFIG = {
  online: {
    label: "Online",
    tone: "success",
  },
  offline: {
    label: "Offline",
    tone: "danger",
  },
  stale: {
    label: "Stale",
    tone: "warning",
  },
  maintenance: {
    label: "Maintenance",
    tone: "neutral",
  },
  disabled: {
    label: "Disabled",
    tone: "neutral",
  },
  active: {
    label: "Active",
    tone: "success",
  },
  inactive: {
    label: "Inactive",
    tone: "neutral",
  },
  error: {
    label: "Error",
    tone: "danger",
  },
  uncalibrated: {
    label: "Uncalibrated",
    tone: "warning",
  },
} as const;

type StatusTone = (typeof STATUS_CONFIG)[keyof typeof STATUS_CONFIG]["tone"];

function getStatusConfig(status: DeviceStatusProps["status"]) {
  return STATUS_CONFIG[status as keyof typeof STATUS_CONFIG];
}

export default function DeviceStatus({
  status,
  showLabel = true,
}: DeviceStatusProps) {
  const config = getStatusConfig(status);

  if (!config) {
    return null;
  }

  return (
    <span
      className={`${styles.status} ${styles[config.tone as StatusTone]}`}
      aria-label={`Device status: ${config.label}`}
    >
      <span className={styles.dot} aria-hidden="true" />

      {showLabel && (
        <span className={styles.label}>
          {config.label}
        </span>
      )}
    </span>
  );
}