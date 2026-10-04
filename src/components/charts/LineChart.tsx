import { useMemo, useState } from "react";
import type { CSSProperties, MouseEvent } from "react";
import styles from "./LineChart.module.css";
import {
  computeAdaptiveTicks,
  computeTimeGeometry,
  formatTimeAxisLabel,
  mapQualityLabel,
} from "./soilChartPresentation.ts";

export interface LineChartPoint {
  label?: string;
  value: number | null;
  timestamp?: string;
  quality?: string;
}

export interface LineChartProps {
  data: LineChartPoint[];
  timeDomain?: { begin?: string; end?: string };

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

  /**
   * Hiển thị quality của điểm dữ liệu
   * trong tooltip.
   */
  showQuality?: boolean;

  /**
   * Hiển thị timestamp của điểm dữ liệu
   * trong tooltip.
   */
  showTimestamp?: boolean;

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


export default function LineChart({
  data,
  timeDomain,
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
  showQuality = true,
  showTimestamp = true,
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
        .filter((value): value is number => value !== null && Number.isFinite(value)),
    [data],
  );

  const chartWidth = width - PADDING.left - PADDING.right;
  const chartHeight = height - PADDING.top - PADDING.bottom;

  const domain = useMemo(() => {
    if (validValues.length === 0) {
      return {
        min: 0,
        max: 100,
      };
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
    if (data.length === 0) return [];
    return computeTimeGeometry(data, {
      chartWidth,
      paddingLeft: PADDING.left,
      chartHeight,
      paddingTop: PADDING.top,
      domain,
      timeDomain,
    });
  }, [data, chartWidth, chartHeight, domain, timeDomain]);

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
    const ticks = computeAdaptiveTicks(domain.min, domain.max, 5);
    return ticks.map((tick, index) => ({
      ...tick,
      y: PADDING.top + (index / Math.max(1, ticks.length - 1)) * chartHeight,
    }));
  }, [domain, chartHeight]);

  const activeTooltip = showTooltip && tooltip && points[tooltip.index]?.y != null ? tooltip : null;

  const handlePointMouseEnter = (
    event: MouseEvent<SVGCircleElement>,
    index: number,
  ) => {
    if (!showTooltip) {
      return;
    }

    const rect =
      event.currentTarget.ownerSVGElement?.getBoundingClientRect();

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
      >
        <g role="group" aria-label={ariaLabel}>
        {showLabels && unit && (
          <text
            className={styles.axisLabel}
            x={PADDING.left - 8}
            y={PADDING.top - 6}
            textAnchor="end"
          >
            {unit}
          </text>
        )}

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
                  {tick.label}
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

        {data.length === 1 && !showDots && points[0]?.y != null && (
          <circle cx={points[0].x} cy={points[0].y} r={4} className={styles.dot} />
        )}

        {points.map((point, index) =>
          point.y === null ? null : (
            <circle
              key={`point-${index}`}
              className={showDots ? styles.dot : styles.hitTarget}
              cx={point.x}
              cy={point.y}
              r={tooltip?.index === index ? 5 : showDots ? 3 : 7}
              tabIndex={showTooltip ? 0 : undefined}
              role={showTooltip ? "button" : undefined}
              aria-label={
                showTooltip
                  ? `${formatValue(point.value as number, unit)}${point.timestamp ? ` at ${formatTimeAxisLabel(point.timestamp)}` : ""}${point.quality ? ` (${mapQualityLabel(point.quality).label})` : ""}`
                  : undefined
              }
              onMouseEnter={showTooltip ? (event) => handlePointMouseEnter(event, index) : undefined}
              onMouseLeave={showTooltip ? () => setTooltip(null) : undefined}
              onFocus={showTooltip ? () => setTooltip({ index, x: point.x, y: point.y ?? PADDING.top }) : undefined}
              onBlur={showTooltip ? () => setTooltip(null) : undefined}
              onTouchStart={showTooltip ? () => setTooltip({ index, x: point.x, y: point.y ?? PADDING.top }) : undefined}
            />
          ),
        )}

        {showLabels && data.length > 0 && (
          data.length === 1 || (data[0].timestamp && data[0].timestamp === data[data.length - 1].timestamp) ? (
            <text
              className={styles.axisLabel}
              x={points[0]?.x ?? PADDING.left + chartWidth / 2}
              y={height - 8}
              textAnchor="middle"
            >
              {data[0].timestamp ? formatTimeAxisLabel(data[0].timestamp) : (data[0].label ?? "")}
            </text>
          ) : (
            <>
              <text
                className={styles.axisLabel}
                x={PADDING.left}
                y={height - 8}
                textAnchor="start"
              >
                {timeDomain?.begin
                  ? formatTimeAxisLabel(timeDomain.begin)
                  : data[0].timestamp
                    ? formatTimeAxisLabel(data[0].timestamp)
                    : (data[0].label ?? "")}
              </text>

              <text
                className={styles.axisLabel}
                x={width - PADDING.right}
                y={height - 8}
                textAnchor="end"
              >
                {timeDomain?.end
                  ? formatTimeAxisLabel(timeDomain.end)
                  : data[data.length - 1].timestamp
                    ? formatTimeAxisLabel(data[data.length - 1].timestamp)
                    : (data[data.length - 1].label ?? "")}
              </text>
            </>
          )
        )}

        {tooltip && activeTooltip && (
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
        </g>
      </svg>

      {tooltip && activeTooltip && (
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

          {showTimestamp &&
            data[tooltip.index].timestamp && (
              <span>
                {formatTimeAxisLabel(data[tooltip.index].timestamp)}
              </span>
            )}

          {showQuality &&
            data[tooltip.index].quality && (
              <span>
                Quality: {mapQualityLabel(data[tooltip.index].quality).label}
              </span>
            )}
        </div>
      )}
    </div>
  );
}
