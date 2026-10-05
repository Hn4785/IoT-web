import type { SoilHistoryData, SoilHistoryPoint } from "../services/stationBrowserService.ts";
import { normalizeApiError } from "./apiError.ts";

export interface HistoryQueryParams {
  stationId: string;
  fields: readonly string[];
  begin: string;
  end: string;
  interval?: string;
  aggregate?: string;
  order?: "asc" | "desc";
  limit?: number;
  cursor?: string;
}

export function buildHistoryQueryKey(p: HistoryQueryParams): string {
  return JSON.stringify({
    stationId: p.stationId,
    fields: [...p.fields].sort(),
    begin: p.begin,
    end: p.end,
    interval: p.interval ?? "1h",
    aggregate: p.aggregate ?? "mean",
    order: p.order ?? "asc",
    limit: p.limit ?? 500,
    cursor: p.cursor ?? "",
  });
}

export function isTransientStatus(status?: number): boolean {
  if (status === undefined || status === 0 || status === 408 || status === 429) return true;
  return status >= 500 && status <= 599;
}

export function extractErrorStatusAndMessage(error: unknown): { status?: number; message: string } {
  const norm = normalizeApiError(error);
  const obj = typeof error === "object" && error !== null ? (error as Record<string, unknown>) : null;
  const resp = typeof obj?.response === "object" && obj?.response !== null ? (obj.response as Record<string, unknown>) : null;
  const data = typeof resp?.data === "object" && resp?.data !== null ? (resp.data as Record<string, unknown>) : null;
  const status = (typeof resp?.status === "number" ? resp.status : undefined)
    ?? (typeof obj?.status === "number" ? obj.status : undefined)
    ?? norm.status;
  const message = (typeof data?.message === "string" ? data.message : "")
    || (norm.message !== "An unexpected error occurred" ? norm.message : "")
    || (error instanceof Error ? error.message : "Request failed");
  return { status, message };
}

export interface StationHistoryRecord {
  stationId: string;
  queryKey: string;
  data: SoilHistoryData | null;
  error: string | null;
  errorStatus?: number;
  isRetained: boolean;
  isStale: boolean;
  fetchedAt: string | null;
  lastSuccessfulQueryKey?: string;
  lastSuccessfulData?: SoilHistoryData;
  pending?: boolean;
}

export function beginStationHistoryRequest(current: StationHistoryRecord | null | undefined, queryKey: string, stationId: string): StationHistoryRecord {
  const retained = handleStationHistoryError(current, queryKey, { status: 503 }, stationId);
  return { ...retained, error: null, errorStatus: undefined, pending: true };
}

export function selectHistoryRecords(records: Record<string, StationHistoryRecord>, queryKeys: readonly string[]): Record<string, StationHistoryRecord> {
  const allowed = new Set(queryKeys);
  return Object.fromEntries(Object.entries(records).filter(([, record]) => allowed.has(record.queryKey)));
}

export function createStationHistoryRequestFence() {
  let generation = 0;
  const stationRequests = new Map<string, number>();
  return {
    begin(stationId: string) {
      const requestId = (stationRequests.get(stationId) ?? 0) + 1;
      stationRequests.set(stationId, requestId);
      return { generation, stationId, requestId };
    },
    isCurrent(request: { generation: number; stationId: string; requestId: number }) {
      return request.generation === generation && stationRequests.get(request.stationId) === request.requestId;
    },
    reset() { generation += 1; stationRequests.clear(); },
  };
}

export function handleStationHistorySuccess(
  _current: StationHistoryRecord | null | undefined,
  queryKey: string,
  result: SoilHistoryData,
  expectedStationId?: string,
): StationHistoryRecord {
  const stationId = expectedStationId ?? result.stationId;
  if (result.stationId !== stationId) {
    return { stationId, queryKey, data: null, error: "Station ID mismatch", isRetained: false, isStale: false, fetchedAt: null };
  }
  const isEmpty = !result.series.length || result.series.every((s) => s.points.length === 0);
  if (isEmpty) {
    return { stationId, queryKey, data: result, error: null, isRetained: false, isStale: false, fetchedAt: result.fetchedAt };
  }
  return {
    stationId, queryKey, data: result, error: null, isRetained: false, isStale: Boolean(result.isStale),
    fetchedAt: result.fetchedAt, lastSuccessfulQueryKey: queryKey, lastSuccessfulData: result,
  };
}

export function handleStationHistoryError(
  current: StationHistoryRecord | null | undefined,
  queryKey: string,
  error: unknown,
  stationId?: string,
): StationHistoryRecord {
  const stId = stationId ?? current?.stationId ?? "";
  const { status, message } = extractErrorStatusAndMessage(error);
  const isTransient = isTransientStatus(status);
  const stationMatches = current?.stationId === stId && current?.lastSuccessfulData?.stationId === stId;
  const canRetain = isTransient && stationMatches && current?.lastSuccessfulQueryKey === queryKey && Boolean(current?.lastSuccessfulData);

  if (canRetain && current?.lastSuccessfulData) {
    return {
      stationId: stId, queryKey, data: { ...current.lastSuccessfulData, isStale: true },
      error: message, errorStatus: status, isRetained: true, isStale: true,
      fetchedAt: current.lastSuccessfulData.fetchedAt,
      lastSuccessfulQueryKey: queryKey, lastSuccessfulData: current.lastSuccessfulData,
    };
  }
  return { stationId: stId, queryKey, data: null, error: message, errorStatus: status, isRetained: false, isStale: false, fetchedAt: null };
}

export function createRequestFence() {
  let cur = 0;
  return {
    get currentRequestId() { return cur; },
    nextRequestId() { return ++cur; },
    isCurrent(id: number) { return id === cur; },
  };
}

export function getHonestProvenanceAndCoverage(data: SoilHistoryData | null, isRetained: boolean, hasFailed = false) {
  const origin = isRetained
    ? "browser retained"
    : data?.dataOrigin === "stored"
      ? "stored"
      : data?.isFromCache
        ? "cache"
        : "upstream";

  let coverageStatus = "unknown";
  let isTruncated = false;
  if (!hasFailed) {
    if (data?.page?.nextCursor) {
      coverageStatus = "partial";
      isTruncated = true;
    } else if (data?.coverage?.status === "complete") {
      coverageStatus = "complete";
    } else if (data?.coverage?.status === "partial") {
      coverageStatus = "partial";
    }
  }
  return {
    origin,
    coverageStatus,
    isTruncated,
    provenanceLabel: origin === "browser retained" ? "browser retained (Last known)" : origin,
    coverageLabel: isTruncated ? "partial (truncated)" : coverageStatus,
  };
}

export interface ChartPointWithGap {
  value: number | null;
  observedAt: string;
  timestamp: string;
  quality?: string;
}

export function insertChartGaps(points: readonly SoilHistoryPoint[], interval?: string): ChartPointWithGap[] {
  if (points.length <= 1) {
    return points.map((p) => ({ value: p.value, observedAt: p.observedAt, timestamp: p.observedAt, quality: p.quality }));
  }
  const bucketMs = interval === "1d" ? 86_400_000 : 3_600_000;
  const out: ChartPointWithGap[] = [];
  for (let i = 0; i < points.length; i++) {
    const cur = points[i]!;
    out.push({ value: cur.value, observedAt: cur.observedAt, timestamp: cur.observedAt, quality: cur.quality });
    if (i < points.length - 1) {
      const curMs = new Date(cur.observedAt).getTime();
      const nextMs = new Date(points[i + 1]!.observedAt).getTime();
      if (nextMs - curMs > bucketMs) {
        const gapIso = new Date(curMs + bucketMs).toISOString();
        out.push({ value: null, observedAt: gapIso, timestamp: gapIso, quality: "unknown" });
      }
    }
  }
  return out;
}

export function safeCsvCell(value: unknown): string {
  if (value == null) return '""';
  const text = String(value).replace(/[\r\n]+/g, " ");
  const guarded = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
  return `"${guarded.replaceAll('"', '""')}"`;
}

export function formatHistoryReportCsv(options: {
  stationCode: string; field: string; begin: string; end: string; origin: string;
  coverageStatus: string; isRetained: boolean; fetchedAt?: string | null;
  points: readonly SoilHistoryPoint[]; unit: string; queryKey?: string;
}): string {
  const q = options.queryKey ?? buildHistoryQueryKey({ stationId: options.stationCode, fields: [options.field], begin: options.begin, end: options.end });
  const meta = [
    `# ${safeCsvCell("Query")},${safeCsvCell(q)}`,
    `# ${safeCsvCell("Source")},${safeCsvCell(options.origin)}`,
    `# ${safeCsvCell("Coverage")},${safeCsvCell(options.coverageStatus)}`,
    `# ${safeCsvCell("Retained")},${safeCsvCell(String(options.isRetained))}`,
    ...(options.fetchedAt ? [`# ${safeCsvCell("Last Successful Fetch")},${safeCsvCell(options.fetchedAt)}`] : []),
  ];
  const header = "observedAt,value,unit,quality";
  const rows = options.points.map((p) => [p.observedAt, p.value, options.unit, p.quality].map(safeCsvCell).join(","));
  return [...meta, header, ...rows].join("\n");
}
