import { useMemo, useState } from "react";
import type { CSSProperties, MouseEvent } from "react";
import styles from "./LineChart.module.css";

export interface LineChartPoint {
  label?: string;
  value: number | null;
  timestamp?: string;
  quality?: string;
}

export interface LineChartProps {
  data: LineChartPoint[];
  width?: number;
  height?: number;
  min?: number;
  max?: number;
  unit?: string;
  showGrid?: boolean;
  showLabels?: boolean;
  showTooltip?: boolean;
  showDots?: boolean;
  showArea?: boolean;
  lineWidth?: number;
  emptyMessage?: string;
  className?: string;
  ariaLabel?: string;
}

interface TooltipState {
  index: number;
  x: number;
  y: number;
}

const PADDING = {
  top: 20,
  right: 20,
  bottom: 32,
  left: 44,
};

const DEFAULT_WIDTH = 640;
const DEFAULT_HEIGHT = 280;

function formatValue(value: number, unit?: string) {
  const formatted = Number.isInteger(value)
    ? value.toString()
    : value.toFixed(2);

  return unit ? `${formatted} ${unit}` : formatted;
}

function formatTimestamp(timestamp?: string) {
  if (!timestamp) {
    return undefined;
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

export default function LineChart({
  data,
  width = DEFAULT_WIDTH,
  height = DEFAULT_HEIGHT,
  min,
  max,
  unit,
  showGrid = true,
  showLabels = true,
  showTooltip = true,
  showDots = true,
  showArea = false,
  lineWidth = 2,
  emptyMessage = "No data available",
  className,
  ariaLabel = "Line chart",
}: LineChartProps) {
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);

  const validValues = useMemo(
    () =>
      data
        .map((point) => point.value)
        .filter((value): value is number => value !== null),
    [data],
  );

  const chartWidth = width - PADDING.left - PADDING.right;
  const chartHeight = height - PADDING.top - PADDING.bottom;

  const domain = useMemo(() => {
    if (validValues.length === 0) {
      return { min: 0, max: 100 };
    }

    const dataMin = min ?? Math.min(...validValues);
    const dataMax = max ?? Math.max(...validValues);

    if (dataMin === dataMax) {
      const offset = Math.abs(dataMin) * 0.1 || 1;

      return {
        min: dataMin - offset,
        max: dataMax + offset,
      };
    }

    const padding = (dataMax - dataMin) * 0.1;

    return {
      min: min ?? dataMin - padding,
      max: max ?? dataMax + padding,
    };
  }, [min, max, validValues]);

  const points = useMemo(() => {
    if (data.length === 0) {
      return [];
    }

    return data.map((point, index) => {
      const x =
        data.length === 1
          ? PADDING.left + chartWidth / 2
          : PADDING.left + (index / (data.length - 1)) * chartWidth;

      if (point.value === null) {
        return {
          ...point,
          x,
          y: null,
        };
      }

      const ratio =
        (point.value - domain.min) / (domain.max - domain.min);

      const y =
        PADDING.top +
        chartHeight -
        Math.max(0, Math.min(1, ratio)) * chartHeight;

      return {
        ...point,
        x,
        y,
      };
    });
  }, [data, chartWidth, chartHeight, domain]);

  const segments = useMemo(() => {
    const result: string[] = [];
    let current: string[] = [];

    points.forEach((point) => {
      if (point.y === null) {
        if (current.length > 0) {
          result.push(current.join(" "));
          current = [];
        }

        return;
      }

      current.push(
        `${current.length === 0 ? "M" : "L"} ${point.x} ${point.y}`,
      );
    });

    if (current.length > 0) {
      result.push(current.join(" "));
    }

    return result;
  }, [points]);

  const areaSegments = useMemo(() => {
    return segments.map((segment) => {
      const coordinates = segment
        .replace(/[ML]/g, "")
        .trim()
        .split(/\s+/)
        .map(Number);

      if (coordinates.length < 2) {
        return "";
      }

      const firstX = coordinates[0];
      const lastX = coordinates[coordinates.length - 2];

      const baseY = PADDING.top + chartHeight;

      return `${segment} L ${lastX} ${baseY} L ${firstX} ${baseY} Z`;
    });
  }, [segments, chartHeight]);

  const yTicks = useMemo(() => {
    const count = 5;
    const range = domain.max - domain.min;

    return Array.from({ length: count }, (_, index) => {
      const ratio = index / (count - 1);

      return {
        value: domain.max - ratio * range,
        y: PADDING.top + ratio * chartHeight,
      };
    });
  }, [domain, chartHeight]);

  const handlePointMouseEnter = (
    event: MouseEvent<SVGCircleElement>,
    index: number,
  ) => {
    if (!showTooltip) {
      return;
    }

    const rect = event.currentTarget.ownerSVGElement?.getBoundingClientRect();

    if (!rect) {
      return;
    }

    setTooltip({
      index,
      x: points[index].x,
      y: points[index].y ?? PADDING.top,
    });
  };

  if (data.length === 0 || validValues.length === 0) {
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

  return (
    <div className={`${styles.wrapper} ${className ?? ""}`}>
      <svg
        className={styles.chart}
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={ariaLabel}
      >
        {showGrid &&
          yTicks.map((tick) => (
            <g key={tick.y}>
              <line
                className={styles.gridLine}
                x1={PADDING.left}
                x2={width - PADDING.right}
                y1={tick.y}
                y2={tick.y}
              />

              {showLabels && (
                <text
                  className={styles.axisLabel}
                  x={PADDING.left - 8}
                  y={tick.y + 4}
                  textAnchor="end"
                >
                  {tick.value.toFixed(0)}
                </text>
              )}
            </g>
          ))}

        {showArea &&
          areaSegments.map((segment, index) => (
            <path
              key={`area-${index}`}
              className={styles.area}
              d={segment}
            />
          ))}

        {segments.map((segment, index) => (
          <path
            key={`line-${index}`}
            className={styles.line}
            d={segment}
            style={
              {
                "--line-width": lineWidth,
              } as CSSProperties
            }
          />
        ))}

        {showDots &&
          points.map((point, index) =>
            point.y === null ? null : (
              <circle
                key={`point-${index}`}
                className={styles.dot}
                cx={point.x}
                cy={point.y}
                r={tooltip?.index === index ? 5 : 3}
                onMouseEnter={(event) =>
                  handlePointMouseEnter(event, index)
                }
                onMouseLeave={() => setTooltip(null)}
              />
            ),
          )}

        {showLabels && data.length > 0 && (
          <>
            <text
              className={styles.axisLabel}
              x={PADDING.left}
              y={height - 8}
              textAnchor="start"
            >
              {data[0].label ?? ""}
            </text>

            <text
              className={styles.axisLabel}
              x={width - PADDING.right}
              y={height - 8}
              textAnchor="end"
            >
              {data[data.length - 1].label ?? ""}
            </text>
          </>
        )}

        {tooltip && points[tooltip.index]?.y !== null && (
          <g
            className={styles.crosshair}
            pointerEvents="none"
          >
            <line
              x1={points[tooltip.index].x}
              x2={points[tooltip.index].x}
              y1={PADDING.top}
              y2={PADDING.top + chartHeight}
            />
          </g>
        )}
      </svg>

      {tooltip && (
        <div
          className={styles.tooltip}
          style={{
            left: `${(tooltip.x / width) * 100}%`,
            top: `${(tooltip.y / height) * 100}%`,
          }}
        >
          <strong>
            {formatValue(
              data[tooltip.index].value as number,
              unit,
            )}
          </strong>

          {data[tooltip.index].timestamp && (
            <span>
              {formatTimestamp(data[tooltip.index].timestamp)}
            </span>
          )}

          {data[tooltip.index].quality && (
            <span>
              Quality: {data[tooltip.index].quality}
            </span>
          )}
        </div>
      )}
    </div>
  );
}