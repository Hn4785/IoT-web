import {
  Battery,
  Radio,
  Router,
  Settings2,
  Signal,
  TriangleAlert,
} from "lucide-react";

import type { Station } from "@/types/station";

import DeviceStatus from "./DeviceStatus";
import styles from "./StationCard.module.css";

interface StationCardProps {
  station: Station;
  farmName?: string;
  plotName?: string;
  onClick?: (station: Station) => void;
  onConfigure?: (station: Station) => void;
}

function formatLastSeen(lastSeen?: string) {
  if (!lastSeen) {
    return "Never";
  }

  const date = new Date(lastSeen);

  if (Number.isNaN(date.getTime())) {
    return "Unknown";
  }

  return date.toLocaleString();
}

function getBatteryClass(battery?: number) {
  if (battery === undefined) {
    return styles.metricValue;
  }

  if (battery <= 20) {
    return `${styles.metricValue} ${styles.dangerValue}`;
  }

  if (battery <= 40) {
    return `${styles.metricValue} ${styles.warningValue}`;
  }

  return styles.metricValue;
}

export default function StationCard({
  station,
  farmName,
  plotName,
  onClick,
  onConfigure,
}: StationCardProps) {
  const hasSensorErrors = station.sensorErrorCount > 0;

  return (
    <article className={styles.card}>
      <div className={styles.header}>
        <div className={styles.identity}>
          <div className={styles.icon}>
            <Router size={20} strokeWidth={1.8} />
          </div>

          <div className={styles.titleGroup}>
            <button
              type="button"
              className={styles.title}
              onClick={() => onClick?.(station)}
            >
              {station.name}
            </button>

            <span className={styles.id}>
              {station.id}
            </span>
          </div>
        </div>

        <DeviceStatus
          deviceType="station"
          status={station.status}
        />
      </div>

      <div className={styles.location}>
        <span>{farmName ?? "Farm not assigned"}</span>

        <span className={styles.separator}>/</span>

        <span>{plotName ?? "Plot not assigned"}</span>
      </div>

      <div className={styles.metrics}>
        <div className={styles.metric}>
          <span className={styles.metricLabel}>
            <Signal size={14} />
            Last Seen
          </span>

          <span className={styles.metricValue}>
            {formatLastSeen(station.lastSeen)}
          </span>
        </div>

        <div className={styles.metric}>
          <span className={styles.metricLabel}>
            <Battery size={14} />
            Battery
          </span>

          <span className={getBatteryClass(station.batteryPercent)}>
            {station.batteryPercent !== undefined
              ? `${station.batteryPercent}%`
              : "—"}
          </span>
        </div>

        <div className={styles.metric}>
          <span className={styles.metricLabel}>
            <Radio size={14} />
            RSSI
          </span>

          <span className={styles.metricValue}>
            {station.rssiDbm !== undefined
              ? `${station.rssiDbm} dBm`
              : "—"}
          </span>
        </div>

        <div className={styles.metric}>
          <span className={styles.metricLabel}>
            Firmware
          </span>

          <span className={styles.metricValue}>
            {station.firmwareVersion ?? "—"}
          </span>
        </div>
      </div>

      <div className={styles.footer}>
        <div className={styles.sensorSummary}>
          <span>
            {station.sensorCount} sensors
          </span>

          {hasSensorErrors && (
            <span className={styles.sensorError}>
              <TriangleAlert size={13} />
              {station.sensorErrorCount} error
              {station.sensorErrorCount > 1 ? "s" : ""}
            </span>
          )}
        </div>

        {onConfigure && (
          <button
            type="button"
            className={styles.configureButton}
            onClick={() => onConfigure(station)}
            aria-label={`Configure ${station.name}`}
          >
            <Settings2 size={16} />
            Configure
          </button>
        )}
      </div>
    </article>
  );
}