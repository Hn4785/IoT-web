import type { QualityFlag } from "@/types/soil";
import SoilQualityBadge from "./SoilQualityBadge";
import styles from "./SoilMetricCard.module.css";

export type SoilMetricTrend = "up" | "down" | "stable";

export interface SoilMetricCardProps {
  title: string;
  value: number | null;
  unit: string;
  quality: QualityFlag;
  updatedAt: string;

  trend?: SoilMetricTrend;
  trendValue?: number | null;

  icon?: React.ReactNode;
  className?: string;
}

const TREND_CONFIG: Record<
  SoilMetricTrend,
  {
    symbol: string;
    label: string;
  }
> = {
  up: {
    symbol: "↑",
    label: "Trending up",
  },
  down: {
    symbol: "↓",
    label: "Trending down",
  },
  stable: {
    symbol: "→",
    label: "Stable",
  },
};

/**
 * Map trend state to CSS Module class.
 *
 * Using an explicit map instead of styles[trend]
 * avoids TypeScript errors with CSS Modules.
 */
const TREND_CLASS: Record<SoilMetricTrend, string> = {
  up: styles.up,
  down: styles.down,
  stable: styles.stable,
};

function formatValue(value: number | null): string {
  if (value === null) {
    return "—";
  }

  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 2,
  }).format(value);
}

function formatUpdatedAt(updatedAt: string): string {
  const date = new Date(updatedAt);

  if (Number.isNaN(date.getTime())) {
    return "Unknown update time";
  }

  return new Intl.DateTimeFormat("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(date);
}

export default function SoilMetricCard({
  title,
  value,
  unit,
  quality,
  updatedAt,
  trend,
  trendValue,
  icon,
  className,
}: SoilMetricCardProps) {
  const trendConfig = trend ? TREND_CONFIG[trend] : undefined;

  const classNames = [styles.card, className]
    .filter(Boolean)
    .join(" ");

  return (
    <article className={classNames}>
      <div className={styles.header}>
        <div className={styles.titleGroup}>
          {icon && (
            <span className={styles.icon} aria-hidden="true">
              {icon}
            </span>
          )}

          <h3 className={styles.title}>{title}</h3>
        </div>

        <SoilQualityBadge quality={quality} />
      </div>

      <div className={styles.valueRow}>
        <div className={styles.valueGroup}>
          <span className={styles.value}>
            {formatValue(value)}
          </span>

          <span className={styles.unit}>{unit}</span>
        </div>

        {trend && trendConfig && (
          <div
            className={`${styles.trend} ${TREND_CLASS[trend]}`}
            aria-label={
              trendValue !== undefined && trendValue !== null
                ? `${trendConfig.label}: ${trendValue}%`
                : trendConfig.label
            }
          >
            <span
              className={styles.trendSymbol}
              aria-hidden="true"
            >
              {trendConfig.symbol}
            </span>

            {trendValue !== undefined && trendValue !== null && (
              <span className={styles.trendValue}>
                {Math.abs(trendValue)}%
              </span>
            )}
          </div>
        )}
      </div>

      <div className={styles.footer}>
        <span className={styles.updatedLabel}>
          Updated
        </span>

        <time
          dateTime={updatedAt}
          className={styles.updatedAt}
        >
          {formatUpdatedAt(updatedAt)}
        </time>
      </div>
    </article>
  );
}