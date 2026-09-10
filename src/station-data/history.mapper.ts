import { createHash } from 'node:crypto';

import type { WeatherHistoryStation } from '../integrations/weather/contracts.js';
import { AppError } from '../common/errors/app-error.js';
import { decodeCursor, encodeCursor } from './cursor.js';
import type {
  NormalizedHistoryPage,
  SoilField,
  SoilHistoryQuery,
} from './station-data.contracts.js';

type SourceRecord = Readonly<Record<string, unknown> & { ts: number; time: string }>;

export type HistoryMapInput = Readonly<{
  stationId: string;
  upstream: readonly WeatherHistoryStation[];
  stationCode: string;
  fields: readonly SoilField[];
  order: 'asc' | 'desc';
  limit: number;
  queryFingerprint: string;
  boundaryFingerprint?: string;
  boundaryOccurrence?: number;
  fetchedAt: Date;
}>;

const digest = (value: unknown): string =>
  createHash('sha256').update(JSON.stringify(value)).digest('hex');

export function historyQueryFingerprint(input: {
  stationCode: string;
  query: Omit<SoilHistoryQuery, 'cursor'>;
}): string {
  return digest({
    aggregate: input.query.aggregate ?? null,
    begin: input.query.begin,
    end: input.query.end,
    fields: [...input.query.fields].sort(),
    interval: input.query.interval,
    limit: input.query.limit,
    order: input.query.order,
    stationCode: input.stationCode,
  });
}

function recordFingerprint(record: SourceRecord, fields: readonly SoilField[]): string {
  const values = Object.fromEntries(
    [...fields]
      .sort()
      .filter((field) => typeof record[field] === 'number' && Number.isFinite(record[field]))
      .map((field) => [field, record[field]]),
  );
  return digest({ ts: record.ts, time: record.time, ...values });
}

const invalidCursor = (): AppError => new AppError('VALIDATION_ERROR', 400, 'Cursor is invalid');
const invalidUpstream = (): AppError =>
  new AppError('UPSTREAM_INVALID_RESPONSE', 502, 'Weather response is invalid');

export function mapHistoryPage(input: HistoryMapInput): NormalizedHistoryPage {
  const matches = input.upstream.filter(({ station }) => station === input.stationCode);
  const records = matches.length === 1 ? matches[0]?.history.soil : undefined;
  if (!records) throw invalidUpstream();

  const sorted = [...records].sort((left, right) =>
    input.order === 'asc' ? left.ts - right.ts : right.ts - left.ts,
  ) as SourceRecord[];
  let start = 0;
  if (input.boundaryFingerprint !== undefined || input.boundaryOccurrence !== undefined) {
    if (!input.boundaryFingerprint || !input.boundaryOccurrence) throw invalidCursor();
    let occurrence = 0;
    const boundaryIndex = sorted.findIndex((record) => {
      if (recordFingerprint(record, input.fields) !== input.boundaryFingerprint) return false;
      occurrence += 1;
      return occurrence === input.boundaryOccurrence;
    });
    if (boundaryIndex < 0) throw invalidCursor();
    start = boundaryIndex + 1;
  }

  const pageRecords = sorted.slice(start, start + input.limit);
  const hasMore = sorted.length > start + input.limit;
  const series = input.fields.flatMap((field) => {
    const points = pageRecords.flatMap((record) => {
      const value = record[field];
      return typeof value === 'number' && Number.isFinite(value)
        ? [{ observedAt: record.time, value, quality: 'good' as const }]
        : [];
    });
    return points.length ? [{ field, unit: null, sensorId: null, depthCm: null, points }] : [];
  });
  if (series.length === 0) throw invalidUpstream();

  let nextCursor: string | null = null;
  const boundary = pageRecords.at(-1);
  if (hasMore && boundary) {
    const boundaryFingerprint = recordFingerprint(boundary, input.fields);
    const boundaryOccurrence = sorted
      .slice(0, start + pageRecords.length)
      .filter((record) => recordFingerprint(record, input.fields) === boundaryFingerprint).length;
    nextCursor = encodeCursor({
      v: 1,
      kind: 'soil-history',
      queryFingerprint: input.queryFingerprint,
      boundaryTime: boundary.time,
      boundaryFingerprint,
      boundaryOccurrence,
    });
  }
  return {
    stationId: input.stationId,
    series,
    fetchedAt: input.fetchedAt.toISOString(),
    nextCursor,
  };
}

export function decodeHistoryCursor(cursor: string, queryFingerprint: string) {
  const decoded = decodeCursor(cursor, 'soil-history');
  if (decoded.queryFingerprint !== queryFingerprint) throw invalidCursor();
  return decoded;
}
