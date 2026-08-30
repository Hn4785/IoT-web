import {
  Activity,
  CalendarClock,
  Gauge,
  Ruler,
  Settings2,
} from "lucide-react";

import type { Sensor } from "@/types/sensor";

import DeviceStatus from "./DeviceStatus";
import styles from "./SensorCard.module.css";

interface SensorCardProps {
  sensor: Sensor;
  stationName?: string;
  onClick?: (sensor: Sensor) => void;
  onConfigure?: (sensor: Sensor) => void;
}

function formatDepth(sensor: Sensor) {
  if (sensor.depth === undefined) {
    return "—";
  }

  return `${sensor.depth} ${sensor.depthUnit ?? "cm"}`;
}

function formatInterval(value?: number) {
  if (value === undefined) {
    return "—";
  }

  return `${value}s`;
}

function getCalibrationLabel(
  sensor: Sensor,
) {
  if (!sensor.calibration) {
    return {
      label: "Not configured",
      className: styles.calibrationNeutral,
    };
  }

  switch (sensor.calibration.status) {
    case "valid":
      return {
        label: "Valid",
        className: styles.calibrationValid,
      };

    case "expired":
      return {
        label: "Expired",
        className: styles.calibrationExpired,
      };

    case "uncalibrated":
      return {
        label: "Uncalibrated",
        className: styles.calibrationWarning,
      };

    default:
      return {
        label: "Unknown",
        className: styles.calibrationNeutral,
      };
  }
}

export default function SensorCard({
  sensor,
  stationName,
  onClick,
  onConfigure,
}: SensorCardProps) {
  const calibration = getCalibrationLabel(sensor);

  return (
    <article className={styles.card}>
      <div className={styles.header}>
        <div className={styles.identity}>
          <div className={styles.icon}>
            <Activity size={20} strokeWidth={1.8} />
          </div>

          <div className={styles.titleGroup}>
            <button
              type="button"
              className={styles.title}
              onClick={() => onClick?.(sensor)}
            >
              {sensor.name ?? sensor.model}
            </button>

            <span className={styles.id}>
              {sensor.id}
            </span>
          </div>
        </div>

        <DeviceStatus
          deviceType="sensor"
          status={sensor.status}
        />
      </div>

      <div className={styles.model}>
        <span>{sensor.model}</span>

        {stationName && (
          <>
            <span className={styles.separator}>•</span>
            <span>{stationName}</span>
          </>
        )}
      </div>

      <div className={styles.measurement}>
        <div className={styles.measurementMain}>
          <span className={styles.field}>
            {sensor.field}
          </span>

          <span className={styles.measurementType}>
            {sensor.measurement}
          </span>
        </div>

        <span className={styles.unit}>
          {sensor.unit}
        </span>
      </div>

      <div className={styles.metrics}>
        <div className={styles.metric}>
          <span className={styles.metricLabel}>
            <Ruler size={14} />
            Depth
          </span>

          <span className={styles.metricValue}>
            {formatDepth(sensor)}
          </span>
        </div>

        <div className={styles.metric}>
          <span className={styles.metricLabel}>
            <Gauge size={14} />
            Measurement
          </span>

          <span className={styles.metricValue}>
            {formatInterval(
              sensor.measurementInterval,
            )}
          </span>
        </div>

        <div className={styles.metric}>
          <span className={styles.metricLabel}>
            <CalendarClock size={14} />
            Send Interval
          </span>

          <span className={styles.metricValue}>
            {formatInterval(sensor.sendInterval)}
          </span>
        </div>

        <div className={styles.metric}>
          <span className={styles.metricLabel}>
            Calibration
          </span>

          <span
            className={`${styles.calibration} ${calibration.className}`}
          >
            {calibration.label}
          </span>
        </div>
      </div>

      <div className={styles.footer}>
        <span className={styles.updated}>
          Sensor configuration
        </span>

        {onConfigure && (
          <button
            type="button"
            className={styles.configureButton}
            onClick={() => onConfigure(sensor)}
          >
            <Settings2 size={15} />
            Configure
          </button>
        )}
      </div>
    </article>
  );
}