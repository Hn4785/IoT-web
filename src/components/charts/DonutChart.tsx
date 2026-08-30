import { useMemo, useState } from "react";
import styles from "./DonutChart.module.css";

export interface DonutChartItem {
  label: string;
  value: number;
  color?: string;
}

export interface DonutChartProps {
  data: DonutChartItem[];
  size?: number;
  strokeWidth?: number;
  centerLabel?: string;
  centerValue?: string | number;
  showLegend?: boolean;
  showPercentage?: boolean;
  emptyMessage?: string;
  className?: string;
  ariaLabel?: string;
}

const DEFAULT_COLORS = [
  "#16a34a",
  "#dc2626",
  "#f59e0b",
  "#2563eb",
  "#64748b",
  "#7c3aed",
];

function polarToCartesian(
  center: number,
  radius: number,
  angle: number,
) {
  const angleInRadians = ((angle - 90) * Math.PI) / 180;

  return {
    x: center + radius * Math.cos(angleInRadians),
    y: center + radius * Math.sin(angleInRadians),
  };
}

function describeArc(
  center: number,
  radius: number,
  startAngle: number,
  endAngle: number,
) {
  const start = polarToCartesian(
    center,
    radius,
    endAngle,
  );

  const end = polarToCartesian(
    center,
    radius,
    startAngle,
  );

  const largeArcFlag =
    endAngle - startAngle <= 180 ? "0" : "1";

  return [
    `M ${start.x} ${start.y}`,
    `A ${radius} ${radius} 0 ${largeArcFlag} 0 ${end.x} ${end.y}`,
  ].join(" ");
}

export default function DonutChart({
  data,
  size = 220,
  strokeWidth = 28,
  centerLabel,
  centerValue,
  showLegend = true,
  showPercentage = true,
  emptyMessage = "No data available",
  className,
  ariaLabel = "Donut chart",
}: DonutChartProps) {
  const [activeIndex, setActiveIndex] = useState<number | null>(
    null,
  );

  const total = useMemo(
    () => data.reduce((sum, item) => sum + item.value, 0),
    [data],
  );

  if (data.length === 0 || total === 0) {
    return (
      <div
        className={`${styles.emptyState} ${className ?? ""}`}
        role="img"
        aria-label={ariaLabel}
      >
        {emptyMessage}
      </div>
    );
  }

  const center = size / 2;
  const radius = (size - strokeWidth) / 2;

  let currentAngle = 0;

  const segments = data.map((item, index) => {
    const percentage = item.value / total;
    const startAngle = currentAngle;
    const endAngle =
      currentAngle + percentage * 360;

    currentAngle = endAngle;

    return {
      ...item,
      percentage,
      startAngle,
      endAngle,
      color:
        item.color ??
        DEFAULT_COLORS[index % DEFAULT_COLORS.length],
    };
  });

  return (
    <div
      className={`${styles.container} ${className ?? ""}`}
    >
      <div className={styles.chartWrapper}>
        <svg
          className={styles.chart}
          viewBox={`0 0 ${size} ${size}`}
          role="img"
          aria-label={ariaLabel}
        >
          <circle
            className={styles.background}
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            strokeWidth={strokeWidth}
          />

          {segments.map((segment, index) => (
            <path
              key={`${segment.label}-${index}`}
              className={`${styles.segment} ${
                activeIndex === index
                  ? styles.active
                  : ""
              }`}
              d={describeArc(
                center,
                radius,
                segment.startAngle,
                segment.endAngle,
              )}
              fill="none"
              stroke={segment.color}
              strokeWidth={strokeWidth}
              onMouseEnter={() => setActiveIndex(index)}
              onMouseLeave={() => setActiveIndex(null)}
            >
              <title>
                {segment.label}: {segment.value}
              </title>
            </path>
          ))}

          {(centerLabel || centerValue !== undefined) && (
            <>
              {centerValue !== undefined && (
                <text
                  className={styles.centerValue}
                  x={center}
                  y={center - 2}
                  textAnchor="middle"
                >
                  {centerValue}
                </text>
              )}

              {centerLabel && (
                <text
                  className={styles.centerLabel}
                  x={center}
                  y={center + 18}
                  textAnchor="middle"
                >
                  {centerLabel}
                </text>
              )}
            </>
          )}
        </svg>
      </div>

      {showLegend && (
        <div className={styles.legend}>
          {segments.map((segment, index) => {
            const percentage =
              segment.percentage * 100;

            return (
              <div
                key={`${segment.label}-legend-${index}`}
                className={`${styles.legendItem} ${
                  activeIndex === index
                    ? styles.legendActive
                    : ""
                }`}
                onMouseEnter={() => setActiveIndex(index)}
                onMouseLeave={() => setActiveIndex(null)}
              >
                <span
                  className={styles.legendDot}
                  style={{
                    backgroundColor: segment.color,
                  }}
                />

                <span className={styles.legendLabel}>
                  {segment.label}
                </span>

                <span className={styles.legendValue}>
                  {segment.value}
                  {showPercentage &&
                    ` (${percentage.toFixed(0)}%)`}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}