export interface AdaptiveTick {
  value: number;
  label: string;
}

export function computeAdaptiveTicks(min: number, max: number, count = 5): AdaptiveTick[] {
  if (!Number.isFinite(min) || !Number.isFinite(max) || count <= 0) return [];
  if (count === 1 || min === max) {
    return [{ value: min, label: Number.isInteger(min) ? min.toString() : min.toFixed(1) }];
  }
  const range = max - min;
  const rawValues = Array.from({ length: count }, (_, i) => max - (i / (count - 1)) * range);

  let precision = 0;
  for (let p = 0; p <= 5; p++) {
    const formatted = rawValues.map((v) => v.toFixed(p));
    if (new Set(formatted).size === rawValues.length) {
      precision = p;
      break;
    }
  }

  return rawValues.map((value) => ({
    value,
    label: value.toFixed(precision),
  }));
}

export interface GeometryOptions {
  chartWidth: number;
  paddingLeft: number;
  chartHeight: number;
  paddingTop: number;
  domain: { min: number; max: number };
  timeDomain?: { begin?: string; end?: string };
}

export interface ChartGeometryPoint {
  x: number;
  y: number | null;
  value: number | null;
  timestamp?: string;
  quality?: string;
  label?: string;
}

export function computeTimeGeometry(
  points: { value: number | null; timestamp?: string; quality?: string; label?: string }[],
  options: GeometryOptions,
): ChartGeometryPoint[] {
  if (points.length === 0) return [];
  const { chartWidth, paddingLeft, chartHeight, paddingTop, domain, timeDomain } = options;
  if (!Number.isFinite(domain.min) || !Number.isFinite(domain.max)) return [];

  const validTimestamps = points
    .map((p) => (p.timestamp ? new Date(p.timestamp).getTime() : NaN))
    .filter((t) => !Number.isNaN(t));

  const hasTimestamps = validTimestamps.length > 0;
  const minTime = timeDomain?.begin
    ? new Date(timeDomain.begin).getTime()
    : hasTimestamps
      ? Math.min(...validTimestamps)
      : 0;
  const maxTime = timeDomain?.end
    ? new Date(timeDomain.end).getTime()
    : hasTimestamps
      ? Math.max(...validTimestamps)
      : 0;
  const timeSpan = maxTime - minTime;

  return points.map((point, index) => {
    let x: number;
    if (points.length === 1) {
      if (hasTimestamps && point.timestamp && timeDomain?.begin && timeDomain?.end && timeSpan > 0) {
        const t = new Date(point.timestamp).getTime();
        const ratio = (t - minTime) / timeSpan;
        x = paddingLeft + Math.max(0, Math.min(1, ratio)) * chartWidth;
      } else {
        x = paddingLeft + chartWidth / 2;
      }
    } else if (hasTimestamps && point.timestamp) {
      const t = new Date(point.timestamp).getTime();
      const ratio = timeSpan > 0 ? (t - minTime) / timeSpan : 0.5;
      x = paddingLeft + Math.max(0, Math.min(1, ratio)) * chartWidth;
    } else {
      x = paddingLeft + (index / (points.length - 1)) * chartWidth;
    }

    const isFiniteValue = point.value !== null && Number.isFinite(point.value);
    if (!isFiniteValue) {
      return { ...point, value: null, x, y: null };
    }

    const domainRange = domain.max - domain.min;
    const ratioY = domainRange > 0 ? ((point.value as number) - domain.min) / domainRange : 0.5;
    const y = paddingTop + chartHeight - Math.max(0, Math.min(1, ratioY)) * chartHeight;

    return { ...point, x, y };
  });
}

export function formatTimeAxisLabel(timestamp?: string): string {
  if (!timestamp) return "";
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return timestamp;

  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const timePart = new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
  const datePart = new Intl.DateTimeFormat(undefined, {
    month: "2-digit",
    day: "2-digit",
  }).format(date);

  let tzShort = "";
  try {
    const parts = new Intl.DateTimeFormat(undefined, { timeZoneName: "short" }).formatToParts(date);
    tzShort = parts.find((p) => p.type === "timeZoneName")?.value || tz;
  } catch {
    tzShort = tz;
  }

  return `${datePart} ${timePart} (${tzShort})`;
}

export type QualityBadgeVariant = "good" | "warning" | "neutral";

export function mapQualityLabel(quality?: string): { label: string; variant: QualityBadgeVariant } {
  switch (quality) {
    case "good":
      return { label: "Data valid", variant: "good" };
    case "stale":
      return { label: "Data stale", variant: "warning" };
    case "out_of_range":
      return { label: "Out of range", variant: "warning" };
    case "uncalibrated":
      return { label: "Uncalibrated", variant: "warning" };
    case "sensor_error":
      return { label: "Sensor error", variant: "warning" };
    default:
      return { label: "Unknown", variant: "neutral" };
  }
}
