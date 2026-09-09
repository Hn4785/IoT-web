import type { WeatherLatestStation } from '../integrations/weather/contracts.js';
import { AppError } from '../common/errors/app-error.js';
import type {
  LatestSoilDataDto,
  NormalizedLatestSoil,
  SoilField,
} from './station-data.contracts.js';
import type { AuthorizedStation } from './station.repository.js';

const invalidUpstream = (): AppError =>
  new AppError('UPSTREAM_INVALID_RESPONSE', 502, 'Weather response is invalid');

function observedAt(value: unknown): string | null {
  if (!Number.isSafeInteger(value) || (value as number) < 0) return null;
  const date = new Date(value as number);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function mapLatestSoil(input: {
  station: AuthorizedStation;
  upstream: readonly WeatherLatestStation[];
  fields: readonly SoilField[];
  fetchedAt: Date;
}): NormalizedLatestSoil {
  const matches = input.upstream.filter(({ station }) => station === input.station.upstreamCode);
  if (matches.length !== 1) throw invalidUpstream();

  const soil: unknown = matches[0]?.latest.soil;
  if (!isRecord(soil) || !isRecord(soil._fieldTs)) throw invalidUpstream();
  const fieldTimestamps = soil._fieldTs;

  const fields = input.fields.flatMap((field) => {
    const value = soil[field];
    const timestamp = observedAt(fieldTimestamps[field]);
    return typeof value === 'number' && Number.isFinite(value) && timestamp
      ? [{ field, value, observedAt: timestamp }]
      : [];
  });
  if (fields.length === 0) throw invalidUpstream();

  return {
    station: { id: input.station.id, name: input.station.name, code: input.station.code },
    fields,
    fetchedAt: input.fetchedAt.toISOString(),
  };
}

export function toLatestSoilDto(
  value: NormalizedLatestSoil,
  now: Date,
  staleAfterMs: number,
  cache: { isFromCache: boolean; isStale: boolean },
): LatestSoilDataDto {
  const fields = value.fields.map((field) => {
    const stale = now.getTime() - Date.parse(field.observedAt) > staleAfterMs;
    return {
      ...field,
      unit: null,
      quality: stale ? ('stale' as const) : ('good' as const),
      sensorId: null,
      depthCm: null,
    };
  });
  return {
    station: value.station,
    measurement: 'soil',
    fields,
    fetchedAt: value.fetchedAt,
    isFromCache: cache.isFromCache,
    isStale: cache.isStale || fields.some(({ quality }) => quality === 'stale'),
  };
}
