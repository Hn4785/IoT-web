import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, MouseEvent } from "react";
import styles from "./LineChart.module.css";
import {
  computeAdaptiveTicks,
  computeSharedDomain,
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

export interface LineChartSeries {
  name?: string;
  color?: string;
  data: LineChartPoint[];
}

export interface LineChartProps {
  data?: LineChartPoint[];
  series?: LineChartSeries[];
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
  seriesIndex?: number;
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
  data = [],
  series,
  timeDomain,
  width,
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
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState<number | null>(null);
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);

  useEffect(() => {
    if (width != null) return;
    const el = containerRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver((entries) => {
      const w = Math.round(entries[0]?.contentRect.width ?? 0);
      if (w > 0) setContainerWidth(w);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [width]);

  const effectiveWidth = width ?? (containerWidth || DEFAULT_WIDTH);
  const effectiveHeight = height ?? DEFAULT_HEIGHT;

  const normalizedSeries = useMemo<LineChartSeries[]>(() => {
    if (series && series.length > 0) return series;
    return [{ data, color: undefined, name: undefined }];
  }, [series, data]);

  const validValues = useMemo(
    () => normalizedSeries.flatMap((s) => s.data.map((p) => p.value).filter((value): value is number => value !== null && Number.isFinite(value))),
    [normalizedSeries],
  );

  const chartWidth = effectiveWidth - PADDING.left - PADDING.right;
  const chartHeight = effectiveHeight - PADDING.top - PADDING.bottom;

  const domain = useMemo(
    () => computeSharedDomain(normalizedSeries, min, max),
    [normalizedSeries, min, max],
  );

  const effectiveTimeDomain = useMemo(() => {
    if (timeDomain?.begin && timeDomain?.end) return timeDomain;
    const ts = normalizedSeries.flatMap((s) => s.data.map((p) => (p.timestamp ? new Date(p.timestamp).getTime() : NaN)).filter((t) => !Number.isNaN(t)));
    if (!ts.length) return timeDomain;
    return {
      begin: timeDomain?.begin ?? new Date(Math.min(...ts)).toISOString(),
      end: timeDomain?.end ?? new Date(Math.max(...ts)).toISOString(),
    };
  }, [timeDomain, normalizedSeries]);


  const seriesGeometries = useMemo(() => {
    return normalizedSeries.map((s) => ({
      name: s.name,
      color: s.color,
      points: computeTimeGeometry(s.data, {
        chartWidth,
        paddingLeft: PADDING.left,
        chartHeight,
        paddingTop: PADDING.top,
        domain,
        timeDomain: effectiveTimeDomain,
      }),
    }));
  }, [normalizedSeries, chartWidth, chartHeight, domain, effectiveTimeDomain]);

  const points = seriesGeometries[0]?.points ?? [];

  const seriesSegments = useMemo(() => {
    return seriesGeometries.map((sg) => {
      const segs: string[] = [];
      let cur: string[] = [];
      sg.points.forEach((p) => {
        if (p.y === null) { if (cur.length) { segs.push(cur.join(" ")); cur = []; } return; }
        cur.push(`${cur.length === 0 ? "M" : "L"} ${p.x} ${p.y}`);
      });
      if (cur.length) segs.push(cur.join(" "));
      return { name: sg.name, color: sg.color, segments: segs };
    });
  }, [seriesGeometries]);

  const seriesAreas = useMemo(() => {
    return seriesSegments.map((ss) => ({
      color: ss.color,
      areas: ss.segments.map((seg) => {
        const c = seg.replace(/[ML]/g, "").trim().split(/\s+/).map(Number);
        return c.length < 2 ? "" : `${seg} L ${c[c.length - 2]} ${PADDING.top + chartHeight} L ${c[0]} ${PADDING.top + chartHeight} Z`;
      }).filter(Boolean),
    }));
  }, [seriesSegments, chartHeight]);

  const yTicks = useMemo(() => {
    const ticks = computeAdaptiveTicks(domain.min, domain.max, 5);
    return ticks.map((tick, index) => ({
      ...tick,
      y: PADDING.top + (index / Math.max(1, ticks.length - 1)) * chartHeight,
    }));
  }, [domain, chartHeight]);

  const activeSeriesGeom = seriesGeometries[tooltip?.seriesIndex ?? 0];
  const activePoint = activeSeriesGeom?.points[tooltip?.index ?? 0];
  const activeTooltip = showTooltip && tooltip && activePoint && activePoint.y != null ? tooltip : null;

  const handlePointMouseEnter = (event: MouseEvent<SVGCircleElement>, seriesIndex: number, index: number) => {
    if (!showTooltip || !event.currentTarget.ownerSVGElement?.getBoundingClientRect()) return;
    const pt = seriesGeometries[seriesIndex]?.points[index];
    if (pt) setTooltip({ seriesIndex, index, x: pt.x, y: pt.y ?? PADDING.top });
  };

  if (normalizedSeries.length === 0 || validValues.length === 0) {
    return (
      <div
        ref={containerRef}
        className={`${styles.emptyState} ${className ?? ""}`}
        role="img"
        aria-label={ariaLabel}
      >
        {emptyMessage}
      </div>
    );
  }

  const tooltipLeftPercent = activePoint ? Math.max(0, Math.min(100, (activePoint.x / effectiveWidth) * 100)) : 0;
  const tooltipTransform = activePoint ? (activePoint.x < 80 ? "translate(0, calc(-100% - 10px))" : activePoint.x > effectiveWidth - 80 ? "translate(-100%, calc(-100% - 10px))" : "translate(-50%, calc(-100% - 10px))") : undefined;


  return (
    <div ref={containerRef} className={`${styles.wrapper} ${className ?? ""}`}>
      <svg
        className={styles.chart}
        viewBox={`0 0 ${effectiveWidth} ${effectiveHeight}`}
        style={{ width: width != null ? width : "100%", height: effectiveHeight }}
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
                x2={effectiveWidth - PADDING.right}
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
          seriesAreas.map((sa, sIdx) =>
            sa.areas.map((segment, index) => (
              <path
                key={`area-${sIdx}-${index}`}
                className={styles.area}
                d={segment}
                style={sa.color ? { fill: sa.color } : undefined}
              />
            )),
          )}

        {seriesSegments.map((sSeg, sIdx) =>
          sSeg.segments.map((segment, index) => (
            <path
              key={`line-${sIdx}-${index}`}
              className={styles.line}
              d={segment}
              style={{ stroke: sSeg.color, "--line-width": lineWidth } as CSSProperties}
            />
          )),
        )}

        {!showDots && seriesGeometries.map((sg, sIdx) =>
          sg.points.map((pt, pIdx) => {
            if (pt.y === null) return null;
            const isIsolated =
              (pIdx === 0 || sg.points[pIdx - 1]?.y === null) &&
              (pIdx === sg.points.length - 1 || sg.points[pIdx + 1]?.y === null);
            return isIsolated ? (
              <circle
                key={`iso-${sIdx}-${pIdx}`}
                cx={pt.x}
                cy={pt.y}
                r={4}
                className={styles.dot}
                style={sg.color ? { stroke: sg.color } : undefined}
              />
            ) : null;
          }),
        )}

        {seriesGeometries.map((sGeom, sIdx) =>
          sGeom.points.map((point, index) =>
            point.y === null ? null : (
              <circle
                key={`point-${sIdx}-${index}`}
                className={showDots ? styles.dot : styles.hitTarget}
                cx={point.x}
                cy={point.y}
                r={tooltip?.seriesIndex === sIdx && tooltip?.index === index ? 5 : showDots ? 3 : 7}
                style={sGeom.color && showDots ? { stroke: sGeom.color } : undefined}
                tabIndex={showTooltip ? 0 : undefined}
                role={showTooltip ? "button" : undefined}
                aria-label={
                  showTooltip
                    ? `${sGeom.name ? `${sGeom.name}: ` : ""}${formatValue(point.value as number, unit)}${point.timestamp ? ` at ${formatTimeAxisLabel(point.timestamp)}` : ""}${point.quality ? ` (${mapQualityLabel(point.quality).label})` : ""}`
                    : undefined
                }
                onMouseEnter={showTooltip ? (event) => handlePointMouseEnter(event, sIdx, index) : undefined}
                onMouseLeave={showTooltip ? () => setTooltip(null) : undefined}
                onFocus={showTooltip ? () => setTooltip({ seriesIndex: sIdx, index, x: point.x, y: point.y ?? PADDING.top }) : undefined}
                onBlur={showTooltip ? () => setTooltip(null) : undefined}
                onTouchStart={showTooltip ? () => setTooltip({ seriesIndex: sIdx, index, x: point.x, y: point.y ?? PADDING.top }) : undefined}
              />
            ),
          ),
        )}

        {showLabels && (
          effectiveTimeDomain?.begin || effectiveTimeDomain?.end ? (
            effectiveTimeDomain.begin && effectiveTimeDomain.end && effectiveTimeDomain.begin !== effectiveTimeDomain.end ? (
              <>
                <text
                  className={styles.axisLabel}
                  x={PADDING.left}
                  y={effectiveHeight - 8}
                  textAnchor="start"
                >
                  {formatTimeAxisLabel(effectiveTimeDomain.begin)}
                </text>
                <text
                  className={styles.axisLabel}
                  x={effectiveWidth - PADDING.right}
                  y={effectiveHeight - 8}
                  textAnchor="end"
                >
                  {formatTimeAxisLabel(effectiveTimeDomain.end)}
                </text>
              </>
            ) : (
              <text
                className={styles.axisLabel}
                x={PADDING.left + chartWidth / 2}
                y={effectiveHeight - 8}
                textAnchor="middle"
              >
                {formatTimeAxisLabel(effectiveTimeDomain.begin || effectiveTimeDomain.end)}
              </text>
            )
          ) : data.length > 0 ? (
            data.length === 1 || (data[0].timestamp && data[0].timestamp === data[data.length - 1].timestamp) ? (
              <text
                className={styles.axisLabel}
                x={points[0]?.x ?? PADDING.left + chartWidth / 2}
                y={effectiveHeight - 8}
                textAnchor="middle"
              >
                {data[0].timestamp ? formatTimeAxisLabel(data[0].timestamp) : (data[0].label ?? "")}
              </text>
            ) : (
              <>
                <text
                  className={styles.axisLabel}
                  x={PADDING.left}
                  y={effectiveHeight - 8}
                  textAnchor="start"
                >
                  {data[0].timestamp ? formatTimeAxisLabel(data[0].timestamp) : (data[0].label ?? "")}
                </text>
                <text
                  className={styles.axisLabel}
                  x={effectiveWidth - PADDING.right}
                  y={effectiveHeight - 8}
                  textAnchor="end"
                >
                  {data[data.length - 1].timestamp
                    ? formatTimeAxisLabel(data[data.length - 1].timestamp)
                    : (data[data.length - 1].label ?? "")}
                </text>
              </>
            )
          ) : null
        )}

        {tooltip && activeTooltip && activePoint && (
          <g
            className={styles.crosshair}
            pointerEvents="none"
          >
            <line
              x1={activePoint.x}
              x2={activePoint.x}
              y1={PADDING.top}
              y2={PADDING.top + chartHeight}
            />
          </g>
        )}
        </g>
      </svg>

      {tooltip && activeTooltip && activePoint && (
        <div
          className={styles.tooltip}
          style={{
            left: `${tooltipLeftPercent}%`,
            top: `${((activePoint.y ?? PADDING.top) / effectiveHeight) * 100}%`,
            transform: tooltipTransform,
          }}
        >
          {activeSeriesGeom?.name && (
            <span className={styles.seriesName} style={activeSeriesGeom.color ? { color: activeSeriesGeom.color } : undefined}>
              {activeSeriesGeom.name}
            </span>
          )}

          <strong>
            {formatValue(
              activePoint.value as number,
              unit,
            )}
          </strong>

          {showTimestamp && activePoint.timestamp && (
            <span>
              {formatTimeAxisLabel(activePoint.timestamp)}
            </span>
          )}

          {showQuality &&
            activePoint.quality && (
              <span>
                Quality: {mapQualityLabel(activePoint.quality).label}
              </span>
            )}
        </div>
      )}
    </div>
  );
}
