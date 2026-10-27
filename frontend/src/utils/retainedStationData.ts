import type { LatestSoilDataDto } from "../types/soil.ts";
import { normalizeApiError } from "./apiError.ts";

export function isTransientError(error: unknown): boolean {
  const status = normalizeApiError(error).status;
  return status === undefined || status >= 500 || status === 408 || status === 429;
}

export function resolveLatestSuccess(
  requestedStationId: string,
  dto: LatestSoilDataDto,
): { ok: true; data: LatestSoilDataDto; isRetained: false } | { ok: false; error: string } {
  if (dto.station?.id !== requestedStationId) {
    return { ok: false, error: `Station ID mismatch: requested ${requestedStationId}, received ${dto.station?.id}` };
  }
  return { ok: true, data: dto, isRetained: false };
}

export function resolveLatestError(
  requestedStationId: string,
  error: unknown,
  prevDto: LatestSoilDataDto | null,
): { data: LatestSoilDataDto | null; isRetained: boolean; error: string } {
  const norm = normalizeApiError(error);
  if (isTransientError(error) && prevDto?.station?.id === requestedStationId && Boolean(prevDto.fields?.length)) {
    return { data: prevDto, isRetained: true, error: norm.message };
  }
  return { data: null, isRetained: false, error: norm.message };
}

export interface FarmerStationState<TSibling> {
  stationId: string;
  reloadKey: number;
  latest: LatestSoilDataDto | null;
  retainedFallback: LatestSoilDataDto | null;
  isRetained: boolean;
  latestPending: boolean;
  latestError: string;
  sibling: TSibling | null;
  siblingPending: boolean;
  siblingError: string;
  accessDenied: boolean;
}

function accessLost(error: unknown): boolean {
  return [401, 403, 404].includes(normalizeApiError(error).status ?? 0);
}

function purgeStation<T>(state: FarmerStationState<T>): FarmerStationState<T> {
  return { ...state, latest: null, retainedFallback: null, isRetained: false,
    sibling: null, latestPending: false, siblingPending: false, accessDenied: true };
}

export function createInitialFarmerState<T>(
  stationId: string,
  reloadKey: number,
  prev?: FarmerStationState<T> | null,
): FarmerStationState<T> {
  const isSame = prev?.stationId === stationId;
  const fallback = isSame ? (prev.latest?.fields?.length ? prev.latest : prev.retainedFallback) : null;
  return {
    stationId,
    reloadKey,
    latest: fallback,
    retainedFallback: fallback,
    isRetained: Boolean(fallback),
    latestPending: true,
    latestError: "",
    sibling: null,
    siblingPending: true,
    siblingError: "",
    accessDenied: false,
  };
}

export function mergeFarmerLatest<T>(
  prev: FarmerStationState<T>,
  stationId: string,
  reloadKey: number,
  result: { ok: true; data: LatestSoilDataDto } | { ok: false; error: unknown },
): FarmerStationState<T> {
  if (prev.stationId !== stationId || prev.reloadKey !== reloadKey || prev.accessDenied) return prev;
  if (result.ok) {
    const validated = resolveLatestSuccess(stationId, result.data);
    if (validated.ok) {
      const hasFields = Boolean(validated.data.fields?.length);
      return {
        ...prev,
        latest: validated.data,
        retainedFallback: hasFields ? validated.data : null,
        isRetained: false,
        latestPending: false,
        latestError: "",
      };
    }
    return purgeStation({
      ...prev,
      latest: null,
      retainedFallback: null,
      isRetained: false,
      latestPending: false,
      latestError: validated.error,
    });
  }
  const errRes = resolveLatestError(stationId, result.error, prev.retainedFallback);
  const next: FarmerStationState<T> = {
    ...prev,
    latest: errRes.data,
    retainedFallback: errRes.data,
    isRetained: errRes.isRetained,
    latestPending: false,
    latestError: errRes.error,
  };
  return accessLost(result.error) ? purgeStation(next) : next;
}

export function mergeFarmerSibling<T>(
  prev: FarmerStationState<T>,
  stationId: string,
  reloadKey: number,
  siblingResult: { ok: true; data: T } | { ok: false; error: unknown; label: string },
): FarmerStationState<T> {
  if (prev.stationId !== stationId || prev.reloadKey !== reloadKey || prev.accessDenied) return prev;
  if (siblingResult.ok) {
    return {
      ...prev,
      sibling: siblingResult.data,
      siblingPending: false,
      siblingError: "",
    };
  }
  const norm = normalizeApiError(siblingResult.error);
  const next: FarmerStationState<T> = {
    ...prev,
    sibling: null,
    siblingPending: false,
    siblingError: `Unable to load ${siblingResult.label}: ${norm.message}`,
  };
  return accessLost(siblingResult.error) ? purgeStation(next) : next;
}

export function mergeStationMetadata<T extends { id: string }>(
  prev: FarmerStationState<T>, stationId: string, reloadKey: number,
  result: { ok: true; data: T } | { ok: false; error: unknown },
): FarmerStationState<T> {
  if (prev.stationId !== stationId || prev.reloadKey !== reloadKey) return prev;
  const mismatch = result.ok && result.data.id !== stationId;
  const status = result.ok ? undefined : normalizeApiError(result.error).status;
  const denied = mismatch || status === 401 || status === 403 || status === 404;
  const next = mergeFarmerSibling(prev, stationId, reloadKey, result.ok && !mismatch
    ? result : { ok: false, error: result.ok ? new Error("Station response does not match the requested station.") : result.error, label: "station details" });
  return denied ? { ...next, accessDenied: true, latest: null, retainedFallback: null,
    isRetained: false, latestPending: false } : next;
}

export interface FencedStationDetailView {
  station: { id: string; name: string; code: string; farmId?: string; plotId?: string } | null;
  latest: LatestSoilDataDto | null;
  isRetained: boolean;
  metaError: string;
  latestError: string;
  loading: boolean;
}

export function fenceStationDetailView(params: {
  routeStationId: string;
  metaStationId: string | null;
  metaStation: { id: string; name: string; code: string; farmId?: string; plotId?: string } | null;
  metaAccessDenied: boolean;
  metaError: string;
  metaPending: boolean;
  latestStationId: string | null;
  latest: LatestSoilDataDto | null;
  isRetained: boolean;
  latestError: string;
  latestPending: boolean;
}): FencedStationDetailView {
  const {
    routeStationId,
    metaStationId,
    metaStation,
    metaAccessDenied,
    metaError,
    metaPending,
    latestStationId,
    latest,
    isRetained,
    latestError,
    latestPending,
  } = params;

  const stationMatch = metaStationId === routeStationId && metaStation?.id === routeStationId;
  const currentStation = stationMatch && !metaAccessDenied ? metaStation : null;

  const accessDenied = metaAccessDenied || (metaStationId === routeStationId && metaStation != null && metaStation.id !== routeStationId);
  const latestMatch = latestStationId === routeStationId && latest?.station?.id === routeStationId;
  const currentLatest = (!accessDenied && latestMatch) ? latest : null;

  return {
    station: currentStation,
    latest: currentLatest,
    isRetained: !accessDenied && latestMatch ? isRetained : false,
    metaError: metaStationId === routeStationId ? metaError : "",
    latestError: !accessDenied && latestStationId === routeStationId ? latestError : "",
    loading: metaPending || latestPending || (currentStation == null && metaStationId !== routeStationId && !metaError),
  };
}

export function formatLatestConnectionStatus(
  latest: LatestSoilDataDto | null,
  isRetained: boolean,
  isLoading: boolean,
): string {
  if (isLoading) return "Refreshing...";
  if (!latest) return "Unavailable";
  if (!latest.fields || latest.fields.length === 0) return "Empty";
  if (isRetained || latest.isStale) return "Stale";
  if (latest.dataOrigin === "stored") return "Stored";
  if (latest.isFromCache) return "Cached";
  return "Connected";
}

export function formatLatestSummaryState(
  latest: LatestSoilDataDto | null,
  isRetained: boolean,
): string {
  if (!latest) return "Unavailable";
  if (!latest.fields || latest.fields.length === 0) return "Empty";
  if (isRetained || latest.isStale) return "Stale";
  if (latest.dataOrigin === "stored") return "Stored";
  return "Live";
}
