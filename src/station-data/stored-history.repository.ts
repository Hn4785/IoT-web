import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service.js';
import { SoilReadingRepository } from './soil-reading.repository.js';
import { AppError } from '../common/errors/app-error.js';
import { decodeCursor, encodeCursor } from './cursor.js';
import { historyQueryFingerprint } from './history.mapper.js';
import type {
  SoilField,
  SoilHistoryCoverageDto,
  SoilHistoryDto,
  SoilHistoryQuery,
} from './station-data.contracts.js';
import type { AuthorizedStation } from './station.repository.js';

@Injectable()
export class StoredHistoryRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly readings: SoilReadingRepository,
  ) {}
  async getHistory(
    station: AuthorizedStation,
    query: SoilHistoryQuery,
  ): Promise<SoilHistoryDto | null> {
    await this.readings.requireActive(station);
    const fingerprint = historyQueryFingerprint({
      stationCode: `stored:${station.dataSourceId}:${station.id}`,
      query,
    });
    const cursor = query.cursor ? decodeCursor(query.cursor, 'stored-soil-history') : undefined;
    if (cursor && cursor.queryFingerprint !== fingerprint)
      throw new AppError('VALIDATION_ERROR', 400, 'Cursor is invalid');
    const boundary = cursor?.boundaryTime ?? null;
    const stride = { raw: 1, '5m': 300_000, '30m': 1_800_000, '1h': 3_600_000, '1d': 86_400_000 }[
      query.interval
    ];
    const cutoff = new Date(Date.now() - 90 * 86_400_000);
    const begin = new Date(Math.max(Date.parse(query.begin), cutoff.getTime()));
    const end = new Date(query.end);
    if (end < begin) return null;
    const rows = await this.prisma.$queryRaw<
      { field: SoilField; value: number; observedAt: Date; fetchedAt: Date }[]
    >`
      WITH samples AS (
        SELECT r.field, r.value, r."observedAt", r."fetchedAt",
          CASE WHEN ${query.interval === 'raw'} THEN r."observedAt"
            ELSE date_bin(${stride} * interval '1 millisecond', r."observedAt", '1970-01-01T00:00:00Z'::timestamptz) END AS bucket
        FROM "SoilReading" r JOIN "DataSource" s ON s.id = r."dataSourceId" AND s."removedAt" IS NULL
        WHERE r."dataSourceId" = ${station.dataSourceId}::uuid AND r."stationId" = ${station.id}::uuid
          AND r.field = ANY(${[...query.fields]}::text[]) AND r."observedAt" BETWEEN ${begin.toISOString()}::timestamptz AND ${end.toISOString()}::timestamptz
      ), ranked AS (
        SELECT *, row_number() OVER (PARTITION BY field, bucket ORDER BY "observedAt") AS first_rank,
          row_number() OVER (PARTITION BY field, bucket ORDER BY "observedAt" DESC) AS last_rank FROM samples
      ), points AS (
        SELECT field, bucket AS "observedAt", min("fetchedAt") AS "fetchedAt",
          CASE ${query.aggregate ?? 'first'} WHEN 'mean' THEN avg(value) WHEN 'min' THEN min(value)
            WHEN 'max' THEN max(value) WHEN 'last' THEN max(value) FILTER (WHERE last_rank = 1)
            ELSE max(value) FILTER (WHERE first_rank = 1) END AS value FROM ranked
        WHERE ${query.interval === 'raw'} OR (bucket >= ${begin.toISOString()}::timestamptz AND bucket + ${stride - 1} * interval '1 millisecond' <= ${end.toISOString()}::timestamptz)
        GROUP BY field, bucket
      ), page_times AS (
        SELECT "observedAt" FROM points
        WHERE ${boundary}::timestamptz IS NULL OR (${query.order === 'asc'} AND "observedAt" > ${boundary}::timestamptz)
          OR (${query.order === 'desc'} AND "observedAt" < ${boundary}::timestamptz)
        GROUP BY "observedAt"
        ORDER BY CASE WHEN ${query.order === 'asc'} THEN "observedAt" END ASC,
          CASE WHEN ${query.order === 'desc'} THEN "observedAt" END DESC LIMIT ${query.limit + 1}
      ) SELECT field, value, "observedAt" AT TIME ZONE 'UTC' AS "observedAt", "fetchedAt" AT TIME ZONE 'UTC' AS "fetchedAt"
      FROM points WHERE "observedAt" IN (SELECT "observedAt" FROM page_times)
      ORDER BY CASE WHEN ${query.order === 'asc'} THEN "observedAt" END ASC,
        CASE WHEN ${query.order === 'desc'} THEN "observedAt" END DESC, field`;
    const coverageRows = await this.coverageRows(station, query);
    await this.readings.requireActive(station);
    if (!rows.length && !coverageRows.length) return null;
    const coverage = historyCoverage(query, coverageRows);
    const times = [...new Set(rows.map((row) => row.observedAt.toISOString()))];
    const selected = new Set(times.slice(0, query.limit));
    const pageRows = rows.filter((row) => selected.has(row.observedAt.toISOString()));
    const lastTime = times[query.limit - 1];
    return {
      stationId: station.id,
      measurement: 'soil',
      dataOrigin: 'stored',
      coverage,
      series: query.fields.flatMap((field) => {
        const points = pageRows
          .filter((row) => row.field === field)
          .map((row) => ({
            observedAt: row.observedAt.toISOString(),
            value: row.value,
            quality: 'good' as const,
          }));
        return points.length ? [{ field, unit: null, sensorId: null, depthCm: null, points }] : [];
      }),
      page: {
        nextCursor:
          times.length > query.limit && lastTime
            ? encodeCursor({
                v: 2,
                kind: 'stored-soil-history',
                queryFingerprint: fingerprint,
                boundaryTime: lastTime,
              })
            : null,
      },
      fetchedAt: new Date(
        [...pageRows, ...coverageRows].reduce(
          (oldest, row) => Math.min(oldest, row.fetchedAt.getTime()),
          Infinity,
        ),
      ).toISOString(),
      isFromCache: true,
      isStale: true,
    };
  }

  async getCoverage(
    station: AuthorizedStation,
    query: SoilHistoryQuery,
  ): Promise<SoilHistoryCoverageDto> {
    const rows = await this.coverageRows(station, query);
    await this.readings.requireActive(station);
    return historyCoverage(query, rows);
  }

  private coverageRows(station: AuthorizedStation, query: SoilHistoryQuery) {
    const cutoff = new Date(Date.now() - 90 * 86_400_000).toISOString();
    return this.prisma.$queryRaw<{ field: SoilField; begin: Date; end: Date; fetchedAt: Date }[]>`
      SELECT r.field, GREATEST(r.begin, ${cutoff}::timestamptz) AT TIME ZONE 'UTC' AS begin, r."end" AT TIME ZONE 'UTC' AS "end",
        r."fetchedAt" AT TIME ZONE 'UTC' AS "fetchedAt"
      FROM "SoilHistoryCoverage" r JOIN "DataSource" s ON s.id = r."dataSourceId" AND s."removedAt" IS NULL
      WHERE r."dataSourceId" = ${station.dataSourceId}::uuid AND r."stationId" = ${station.id}::uuid
        AND r.field = ANY(${[...query.fields]}::text[]) AND r.begin <= ${query.end}::timestamptz
        AND r."end" >= GREATEST(${query.begin}::timestamptz, ${cutoff}::timestamptz) AND ${query.end}::timestamptz >= ${cutoff}::timestamptz`;
  }
}

function historyCoverage(
  query: SoilHistoryQuery,
  rows: readonly { field: string; begin: Date; end: Date }[],
): SoilHistoryCoverageDto {
  const begin = Date.parse(query.begin);
  const end = Date.parse(query.end);
  const fields = query.fields.map((field) => {
    const merged: { begin: number; end: number }[] = [];
    for (const row of rows
      .filter((row) => row.field === field)
      .sort((a, b) => a.begin.getTime() - b.begin.getTime())) {
      const clipped = {
        begin: Math.max(begin, row.begin.getTime()),
        end: Math.min(end, row.end.getTime()),
      };
      const previous = merged.at(-1);
      if (previous && clipped.begin <= previous.end + 1)
        previous.end = Math.max(previous.end, clipped.end);
      else merged.push(clipped);
    }
    return {
      field,
      ranges: merged.map((range) => ({
        begin: new Date(range.begin).toISOString(),
        end: new Date(range.end).toISOString(),
      })),
    };
  });
  const complete = fields.every(({ ranges }) => {
    const range = ranges[0];
    return (
      ranges.length === 1 &&
      range !== undefined &&
      Date.parse(range.begin) === begin &&
      Date.parse(range.end) === end
    );
  });
  return {
    status: complete
      ? 'complete'
      : fields.some(({ ranges }) => ranges.length)
        ? 'partial'
        : 'unknown',
    fields,
  };
}
