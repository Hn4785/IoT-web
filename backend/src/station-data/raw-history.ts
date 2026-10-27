import { AppError } from '../common/errors/app-error.js';
import type { WeatherHistoryStation } from '../integrations/weather/contracts.js';
import type { NormalizedLatestSoil, SoilField } from './station-data.contracts.js';

export type RawHistoryBatch = Readonly<{
  readings: NormalizedLatestSoil['fields'];
  completeFields: readonly SoilField[];
  rawCount: number;
  lastTimestamp: number | null;
}>;

export function normalizeRawHistory(input: {
  upstream: readonly WeatherHistoryStation[];
  stationCode: string;
  fields: readonly SoilField[];
  begin: Date;
  end: Date;
  order?: 'asc' | 'desc';
}): RawHistoryBatch {
  const invalid = () =>
    new AppError('UPSTREAM_INVALID_RESPONSE', 502, 'Weather response is invalid');
  const matches = input.upstream.filter(({ station }) => station === input.stationCode);
  const records = matches.length === 1 ? matches[0]?.history.soil : undefined;
  if (!records) throw invalid();
  const complete = new Set(input.fields);
  const values = new Map<string, NormalizedLatestSoil['fields'][number]>();
  const conflicts = new Set<string>();
  let previous: number | undefined;
  let lastTimestamp: number | null = null;
  for (const record of records) {
    const timestamp = record.ts;
    const date = new Date(timestamp);
    if (
      !Number.isFinite(date.getTime()) ||
      timestamp < input.begin.getTime() ||
      timestamp > input.end.getTime()
    )
      throw invalid();
    if (
      previous !== undefined &&
      (input.order === 'desc' ? timestamp > previous : timestamp < previous)
    )
      throw invalid();
    previous = timestamp;
    lastTimestamp = timestamp;
    for (const field of input.fields) {
      const value = record[field];
      if (typeof value !== 'number' || !Number.isFinite(value)) {
        complete.delete(field);
        continue;
      }
      const key = `${field}:${String(timestamp)}`;
      if (conflicts.has(key)) continue;
      const existing = values.get(key);
      if (existing && existing.value !== value) {
        values.delete(key);
        conflicts.add(key);
        complete.delete(field);
      } else {
        values.set(key, { field, value, observedAt: date.toISOString() });
      }
    }
  }
  return {
    readings: [...values.values()].sort(
      (left, right) =>
        left.observedAt.localeCompare(right.observedAt) ||
        input.fields.indexOf(left.field) - input.fields.indexOf(right.field),
    ),
    completeFields: input.fields.filter((field) => complete.has(field)),
    rawCount: records.length,
    lastTimestamp,
  };
}
