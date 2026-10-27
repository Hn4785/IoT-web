import { useMemo, useState } from "react";
import styles from "./BarChart.module.css";

export interface BarChartItem {
  label: string;
  value: number;
  color?: string;
  description?: string;
}

export interface BarChartProps {
  data: BarChartItem[];
  height?: number;
  max?: number;
  unit?: string;
  horizontal?: boolean;
  showValues?: boolean;
  showGrid?: boolean;
  showTooltip?: boolean;
  emptyMessage?: string;
  className?: string;
  ariaLabel?: string;
}

const PADDING = {
  top: 20,
  right: 20,
  bottom: 42,
  left: 48,
};

function formatValue(value: number, unit?: string) {
  const formatted = Number.isInteger(value)
    ? value.toString()
    : value.toFixed(2);

  return unit ? `${formatted} ${unit}` : formatted;
}

export default function BarChart({
  data,
  height = 280,
  max,
  unit,
  horizontal = false,
  showValues = true,
  showGrid = true,
  showTooltip = true,
  emptyMessage = "No data available",
  className,
  ariaLabel = "Bar chart",
}: BarChartProps) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  const chartMax = useMemo(() => {
    if (max !== undefined) {
      return max;
    }

    const highest = Math.max(...data.map((item) => item.value), 0);

    return highest === 0 ? 100 : highest * 1.15;
  }, [data, max]);

  if (data.length === 0) {
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

  const width = 640;
  const chartWidth = width - PADDING.left - PADDING.right;
  const chartHeight = height - PADDING.top - PADDING.bottom;

  if (horizontal) {
    const rowHeight = chartHeight / data.length;

    return (
      <div className={`${styles.wrapper} ${className ?? ""}`}>
        <svg
          className={styles.chart}
          viewBox={`0 0 ${width} ${height}`}
          role="img"
          aria-label={ariaLabel}
        >
          {data.map((item, index) => {
            const barWidth =
              (item.value / chartMax) * chartWidth;

            const y =
              PADDING.top +
              index * rowHeight +
              rowHeight * 0.2;

            const barHeight = rowHeight * 0.6;

            return (
              <g
                key={`${item.label}-${index}`}
                onMouseEnter={() => setActiveIndex(index)}
                onMouseLeave={() => setActiveIndex(null)}
              >
                {showGrid && (
                  <line
                    className={styles.gridLine}
                    x1={PADDING.left}
                    x2={PADDING.left}
                    y1={PADDING.top}
                    y2={height - PADDING.bottom}
                  />
                )}

                <text
                  className={styles.label}
                  x={PADDING.left - 10}
                  y={y + barHeight / 2 + 4}
                  textAnchor="end"
                >
                  {item.label}
                </text>

                <rect
                  className={styles.bar}
                  x={PADDING.left}
                  y={y}
                  width={Math.max(0, barWidth)}
                  height={barHeight}
                  rx={4}
                  style={
                    item.color
                      ? { fill: item.color }
                      : undefined
                  }
                />

                {showValues && (
                  <text
                    className={styles.value}
                    x={PADDING.left + barWidth + 8}
                    y={y + barHeight / 2 + 4}
                  >
                    {formatValue(item.value, unit)}
                  </text>
                )}

                {showTooltip && activeIndex === index && (
                  <title>
                    {item.label}: {formatValue(item.value, unit)}
                    {item.description
                      ? ` — ${item.description}`
                      : ""}
                  </title>
                )}
              </g>
            );
          })}
        </svg>
      </div>
    );
  }

  const barGap = 12;
  const barWidth =
    (chartWidth - barGap * (data.length - 1)) /
    data.length;

  return (
    <div className={`${styles.wrapper} ${className ?? ""}`}>
      <svg
        className={styles.chart}
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={ariaLabel}
      >
        {showGrid &&
          [0, 0.25, 0.5, 0.75, 1].map((ratio) => {
            const y =
              PADDING.top + chartHeight * ratio;

            const value = chartMax * (1 - ratio);

            return (
              <g key={ratio}>
                <line
                  className={styles.gridLine}
                  x1={PADDING.left}
                  x2={width - PADDING.right}
                  y1={y}
                  y2={y}
                />

                <text
                  className={styles.axisLabel}
                  x={PADDING.left - 8}
                  y={y + 4}
                  textAnchor="end"
                >
                  {value.toFixed(0)}
                </text>
              </g>
            );
          })}

        {data.map((item, index) => {
          const barHeight =
            (item.value / chartMax) * chartHeight;

          const x =
            PADDING.left +
            index * (barWidth + barGap);

          const y =
            PADDING.top +
            chartHeight -
            barHeight;

          return (
            <g
              key={`${item.label}-${index}`}
              onMouseEnter={() => setActiveIndex(index)}
              onMouseLeave={() => setActiveIndex(null)}
            >
              <rect
                className={`${styles.bar} ${
                  activeIndex === index ? styles.active : ""
                }`}
                x={x}
                y={y}
                width={Math.max(0, barWidth)}
                height={Math.max(0, barHeight)}
                rx={4}
                style={
                  item.color
                    ? { fill: item.color }
                    : undefined
                }
              />

              {showValues && (
                <text
                  className={styles.value}
                  x={x + barWidth / 2}
                  y={y - 8}
                  textAnchor="middle"
                >
                  {formatValue(item.value, unit)}
                </text>
              )}

              <text
                className={styles.label}
                x={x + barWidth / 2}
                y={height - 14}
                textAnchor="middle"
              >
                {item.label}
              </text>

              {showTooltip && activeIndex === index && (
                <title>
                  {item.label}: {formatValue(item.value, unit)}
                  {item.description
                    ? ` — ${item.description}`
                    : ""}
                </title>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}