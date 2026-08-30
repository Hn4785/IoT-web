import { useEffect, useState } from "react";
import type { LineChartPoint } from "./LineChart";
import LineChart from "./LineChart";
import styles from "./RealtimeChart.module.css";

export type RealtimeConnectionStatus =
  | "connected"
  | "connecting"
  | "disconnected"
  | "error";

export interface RealtimeChartProps {
  data: LineChartPoint[];

  title?: string;
  unit?: string;

  connectionStatus?: RealtimeConnectionStatus;

  lastUpdated?: string;

  live?: boolean;

  height?: number;

  showGrid?: boolean;
  showDots?: boolean;
  showArea?: boolean;

  emptyMessage?: string;

  className?: string;
  ariaLabel?: string;
}

function formatLastUpdated(timestamp?: string) {
  if (!timestamp) {
    return "No update yet";
  }

  const date = new Date(timestamp);

  if (Number.isNaN(date.getTime())) {
    return timestamp;
  }

  return new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(date);
}

function getStatusLabel(
  status: RealtimeConnectionStatus,
) {
  switch (status) {
    case "connected":
      return "Connected";

    case "connecting":
      return "Connecting";

    case "disconnected":
      return "Disconnected";

    case "error":
      return "Connection error";

    default:
      return "Unknown";
  }
}

export default function RealtimeChart({
  data,
  title,
  unit,
  connectionStatus = "connected",
  lastUpdated,
  live = true,
  height = 280,
  showGrid = true,
  showDots = true,
  showArea = true,
  emptyMessage = "Waiting for realtime data...",
  className,
  ariaLabel = "Realtime chart",
}: RealtimeChartProps) {
  const [isRecentlyUpdated, setIsRecentlyUpdated] =
    useState(false);

  useEffect(() => {
    if (!lastUpdated) {
      return;
    }

    setIsRecentlyUpdated(true);

    const timeout = window.setTimeout(() => {
      setIsRecentlyUpdated(false);
    }, 800);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [lastUpdated]);

  return (
    <section
      className={`${styles.container} ${className ?? ""}`}
    >
      {(title || live || connectionStatus) && (
        <header className={styles.header}>
          <div className={styles.titleGroup}>
            {title && (
              <h3 className={styles.title}>{title}</h3>
            )}

            {live && (
              <span
                className={`${styles.liveBadge} ${
                  connectionStatus === "connected"
                    ? styles.live
                    : styles.notLive
                }`}
              >
                <span className={styles.liveDot} />
                Live
              </span>
            )}
          </div>

          <div className={styles.meta}>
            <span
              className={`${styles.connection} ${
                styles[connectionStatus]
              }`}
            >
              {getStatusLabel(connectionStatus)}
            </span>

            <span
              className={`${styles.lastUpdated} ${
                isRecentlyUpdated
                  ? styles.updated
                  : ""
              }`}
            >
              Updated {formatLastUpdated(lastUpdated)}
            </span>
          </div>
        </header>
      )}

      <div className={styles.chartContainer}>
        <LineChart
          data={data}
          height={height}
          unit={unit}
          showGrid={showGrid}
          showDots={showDots}
          showArea={showArea}
          showTooltip
          ariaLabel={ariaLabel}
          emptyMessage={emptyMessage}
        />
      </div>
    </section>
  );
}