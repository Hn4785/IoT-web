import { Inject, Injectable, Optional } from '@nestjs/common';
import { RUNTIME_CONFIG } from '../config/runtime-config.module.js';
import type { RuntimeConfig } from '../config/runtime-config.js';

import { PrismaService } from '../database/prisma.service.js';
import { AppError } from '../common/errors/app-error.js';
import type { Prisma } from '../generated/prisma/client.js';
import type { NormalizedLatestSoil, SoilField } from './station-data.contracts.js';
import type { AuthorizedStation } from './station.repository.js';
import type { RawHistoryBatch } from './raw-history.js';
import { CollectionLeaseLostError, type CollectionWriteOptions } from './collection-write.js';

@Injectable()
export class SoilReadingRepository {
  constructor(
    private readonly prisma: PrismaService,
    @Optional() @Inject(RUNTIME_CONFIG) private readonly config?: RuntimeConfig,
  ) {}

  async requireActive(station: AuthorizedStation): Promise<void> {
    const row = await this.prisma.station.findFirst({
      where: {
        id: station.id,
        dataSourceId: station.dataSourceId,
        dataSource: { removedAt: null },
      },
      select: { id: true },
    });
    if (!row) throw new AppError('NOT_FOUND', 404, 'Resource not found');
  }

  async getLatest(
    station: AuthorizedStation,
    fields: readonly SoilField[],
  ): Promise<NormalizedLatestSoil | null> {
    await this.requireActive(station);
    const rows = await this.prisma.$queryRaw<
      {
        field: SoilField;
        value: number;
        observedAt: Date;
        fetchedAt: Date;
      }[]
    >`
      SELECT r.field, r.value, r."observedAt" AT TIME ZONE 'UTC' AS "observedAt",
        r."fetchedAt" AT TIME ZONE 'UTC' AS "fetchedAt" FROM "SoilLatestReading" r
      JOIN "DataSource" s ON s.id = r."dataSourceId" AND s."removedAt" IS NULL
      WHERE r."dataSourceId" = ${station.dataSourceId}::uuid AND r."stationId" = ${station.id}::uuid
        AND field = ANY(${[...fields]}::text[]) ORDER BY field`;
    if (!rows.length) {
      await this.requireActive(station);
      return null;
    }
    return {
      station: { id: station.id, code: station.code, name: station.name },
      fields: rows.map((row) => ({
        field: row.field,
        value: row.value,
        observedAt: row.observedAt.toISOString(),
      })),
      fetchedAt: new Date(Math.min(...rows.map((row) => row.fetchedAt.getTime()))).toISOString(),
      dataOrigin: 'stored',
    };
  }

  async ingestLatest(
    station: AuthorizedStation,
    reading: NormalizedLatestSoil,
    options?: CollectionWriteOptions,
  ): Promise<{ storageLimited: boolean }> {
    return this.prisma.$transaction(async (tx) => {
      await this.guardWrite(tx, station, options);
      const allowNew = await this.canInsert(tx, station, reading.fields);
      for (const field of reading.fields) {
        await this.writeReading(
          tx,
          station,
          field,
          new Date(reading.fetchedAt),
          'latest',
          allowNew,
        );
      }
      await this.finishWrite(tx, station, this.capacityOptions(options, allowNew));
      return { storageLimited: !allowNew };
    });
  }

  async ingestHistory(
    station: AuthorizedStation,
    batch: RawHistoryBatch,
    fetchedAt: Date,
    coverage?: { begin: Date; end: Date },
    options?: CollectionWriteOptions,
  ): Promise<{ storageLimited: boolean }> {
    return this.prisma.$transaction(async (tx) => {
      await this.guardWrite(tx, station, options);
      const allowNew = await this.canInsert(tx, station, batch.readings);
      if (batch.readings.length) {
        const payload = JSON.stringify(batch.readings);
        await tx.$executeRaw`
          INSERT INTO "SoilReading" ("dataSourceId", "stationId", field, "observedAt", value, "fetchedAt", "lastFetchedAt", origin)
          SELECT ${station.dataSourceId}::uuid, ${station.id}::uuid, field, "observedAt", value,
            ${fetchedAt.toISOString()}::timestamptz, ${fetchedAt.toISOString()}::timestamptz, 'rawHistory'
          FROM jsonb_to_recordset(${payload}::jsonb) AS incoming(field text, value double precision, "observedAt" timestamptz)
          WHERE ${allowNew} OR EXISTS (SELECT 1 FROM "SoilReading" r WHERE r."dataSourceId" = ${station.dataSourceId}::uuid
            AND r."stationId" = ${station.id}::uuid AND r.field = incoming.field AND r."observedAt" = incoming."observedAt")
          ON CONFLICT ("dataSourceId", "stationId", field, "observedAt") DO UPDATE
          SET value = EXCLUDED.value,
            "fetchedAt" = CASE WHEN "SoilReading".value <> EXCLUDED.value THEN EXCLUDED."fetchedAt" ELSE "SoilReading"."fetchedAt" END,
            origin = CASE WHEN "SoilReading".value <> EXCLUDED.value THEN EXCLUDED.origin ELSE "SoilReading".origin END,
            "lastFetchedAt" = EXCLUDED."lastFetchedAt",
            revision = "SoilReading".revision + CASE WHEN "SoilReading".value <> EXCLUDED.value THEN 1 ELSE 0 END
          WHERE EXCLUDED."lastFetchedAt" > "SoilReading"."lastFetchedAt"`;
        await tx.$executeRaw`
          INSERT INTO "SoilLatestReading" ("dataSourceId", "stationId", field, "observedAt", value, "fetchedAt", "lastFetchedAt", origin)
          SELECT DISTINCT ON (field) ${station.dataSourceId}::uuid, ${station.id}::uuid, field, "observedAt", value,
            ${fetchedAt.toISOString()}::timestamptz, ${fetchedAt.toISOString()}::timestamptz, 'rawHistory'
          FROM jsonb_to_recordset(${payload}::jsonb) AS incoming(field text, value double precision, "observedAt" timestamptz)
          ORDER BY field, "observedAt" DESC
          ON CONFLICT ("dataSourceId", "stationId", field) DO UPDATE
          SET value = EXCLUDED.value, "observedAt" = EXCLUDED."observedAt",
            "fetchedAt" = CASE WHEN "SoilLatestReading"."observedAt" <> EXCLUDED."observedAt" OR "SoilLatestReading".value <> EXCLUDED.value THEN EXCLUDED."fetchedAt" ELSE "SoilLatestReading"."fetchedAt" END,
            origin = CASE WHEN "SoilLatestReading"."observedAt" <> EXCLUDED."observedAt" OR "SoilLatestReading".value <> EXCLUDED.value THEN EXCLUDED.origin ELSE "SoilLatestReading".origin END,
            "lastFetchedAt" = EXCLUDED."lastFetchedAt",
            revision = "SoilLatestReading".revision + CASE WHEN "SoilLatestReading".value <> EXCLUDED.value THEN 1 ELSE 0 END
          WHERE EXCLUDED."observedAt" > "SoilLatestReading"."observedAt"
            OR (EXCLUDED."observedAt" = "SoilLatestReading"."observedAt"
              AND EXCLUDED."lastFetchedAt" > "SoilLatestReading"."lastFetchedAt")`;
      }
      if (coverage && allowNew) {
        for (const field of batch.completeFields) {
          await tx.$executeRaw`
            INSERT INTO "SoilHistoryCoverage" ("dataSourceId", "stationId", field, begin, "end", "fetchedAt")
            VALUES (${station.dataSourceId}::uuid, ${station.id}::uuid, ${field}, ${coverage.begin.toISOString()}::timestamptz, ${coverage.end.toISOString()}::timestamptz, ${fetchedAt.toISOString()}::timestamptz)
            ON CONFLICT ("dataSourceId", "stationId", field, begin) DO UPDATE
            SET "end" = GREATEST("SoilHistoryCoverage"."end", EXCLUDED."end"),
              "fetchedAt" = GREATEST("SoilHistoryCoverage"."fetchedAt", EXCLUDED."fetchedAt")`;
        }
      }
      await this.finishWrite(tx, station, this.capacityOptions(options, allowNew));
      return { storageLimited: !allowNew };
    });
  }

  private capacityOptions(
    options: CollectionWriteOptions | undefined,
    allowNew: boolean,
  ): CollectionWriteOptions | undefined {
    if (allowNew || !options?.checkpoint) return options;
    const checkpoint = { ...options.checkpoint };
    delete checkpoint.resumeAt;
    return { ...options, checkpoint: { ...checkpoint, outcome: 'storage_limit' } };
  }

  private async canInsert(
    tx: Prisma.TransactionClient,
    station: AuthorizedStation,
    fields: NormalizedLatestSoil['fields'],
  ): Promise<boolean> {
    if (!fields.length) return true;
    const payload = JSON.stringify(fields);
    const counts = await tx.$queryRaw<
      { globalCount: bigint; stationCount: bigint; incomingCount: bigint }[]
    >`
      SELECT (SELECT count(*) FROM "SoilReading") AS "globalCount",
        (SELECT count(*) FROM "SoilReading" WHERE "stationId" = ${station.id}::uuid) AS "stationCount",
        (SELECT count(*) FROM jsonb_to_recordset(${payload}::jsonb) AS incoming(field text, "observedAt" timestamptz)
          WHERE NOT EXISTS (SELECT 1 FROM "SoilReading" r WHERE r."dataSourceId" = ${station.dataSourceId}::uuid
            AND r."stationId" = ${station.id}::uuid AND r.field = incoming.field AND r."observedAt" = incoming."observedAt")) AS "incomingCount"`;
    const count = counts[0];
    if (!count) throw new Error('Storage count unavailable');
    return (
      Number(count.globalCount + count.incomingCount) <=
        (this.config?.soilRawGlobalLimit ?? 10_000_000) &&
      Number(count.stationCount + count.incomingCount) <=
        (this.config?.soilRawStationLimit ?? 2_000_000)
    );
  }

  async updateCollectionCheckpoint(
    station: AuthorizedStation,
    options: CollectionWriteOptions,
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await this.guardWrite(tx, station, options);
      await this.finishWrite(tx, station, options);
    });
  }

  async prune(
    now: Date,
    limit = 5000,
  ): Promise<{ readingsPurged: number; coverageRowsHandled: number }> {
    if (!Number.isInteger(limit) || limit < 1 || limit > 5000)
      throw new AppError('VALIDATION_ERROR', 400, 'Retention batch is invalid');
    const cutoff = new Date(now.getTime() - 90 * 86_400_000).toISOString();
    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(56010501)`;
      const readingsPurged = await tx.$executeRaw`
        DELETE FROM "SoilReading" WHERE ctid IN (
          SELECT ctid FROM "SoilReading" WHERE "observedAt" < ${cutoff}::timestamptz ORDER BY "observedAt" LIMIT ${limit} FOR UPDATE)`;
      const coverage = await tx.$queryRaw<{ count: bigint }[]>`
        WITH old_ranges AS (
          DELETE FROM "SoilHistoryCoverage" WHERE ctid IN (
            SELECT ctid FROM "SoilHistoryCoverage" WHERE begin < ${cutoff}::timestamptz LIMIT ${limit} FOR UPDATE)
          RETURNING *
        ), clipped AS (
          INSERT INTO "SoilHistoryCoverage" ("dataSourceId", "stationId", field, begin, "end", "fetchedAt")
          SELECT "dataSourceId", "stationId", field, ${cutoff}::timestamptz, max("end"), max("fetchedAt")
          FROM old_ranges WHERE "end" >= ${cutoff}::timestamptz GROUP BY "dataSourceId", "stationId", field
          ON CONFLICT ("dataSourceId", "stationId", field, begin) DO UPDATE
          SET "end" = GREATEST("SoilHistoryCoverage"."end", EXCLUDED."end"),
            "fetchedAt" = GREATEST("SoilHistoryCoverage"."fetchedAt", EXCLUDED."fetchedAt") RETURNING field
        ) SELECT count(*) FROM old_ranges`;
      return { readingsPurged, coverageRowsHandled: Number(coverage[0]?.count ?? 0) };
    });
  }

  private async checkLease(
    tx: Prisma.TransactionClient,
    options?: CollectionWriteOptions,
  ): Promise<void> {
    if (!options) return;
    if (options.canCommit && !options.canCommit()) throw new CollectionLeaseLostError();
    const rows = await tx.$queryRaw<{ name: string }[]>`
      SELECT name FROM "EvaluatorLease" WHERE name = 'soil-collector'
        AND "holderId" = ${options.holderId} AND "expiresAt" > clock_timestamp() FOR UPDATE`;
    if (rows.length !== 1) throw new CollectionLeaseLostError();
  }

  private async guardWrite(
    tx: Prisma.TransactionClient,
    station: AuthorizedStation,
    options?: CollectionWriteOptions,
  ): Promise<void> {
    // Retention coverage clipping takes FK locks. Always take its global lock first.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(56010501)`;
    await this.checkLease(tx, options);
    // Source removal takes the same row lock, fencing responses already in flight.
    const sources = await tx.$queryRaw<{ id: string }[]>`
      SELECT id FROM "DataSource" WHERE id = ${station.dataSourceId}::uuid
        AND "removedAt" IS NULL FOR UPDATE`;
    if (sources.length !== 1) throw new AppError('NOT_FOUND', 404, 'Resource not found');
    if (options) {
      const stations = await tx.$queryRaw<{ id: string }[]>`
        SELECT id FROM "Station" WHERE id = ${station.id}::uuid AND "dataSourceId" = ${station.dataSourceId}::uuid FOR UPDATE`;
      if (stations.length !== 1) throw new AppError('NOT_FOUND', 404, 'Resource not found');
      // Locks can wait beyond expiry. Transaction-start CURRENT_TIMESTAMP is not a fence.
      await this.checkLease(tx, options);
    }
  }

  private async finishWrite(
    tx: Prisma.TransactionClient,
    station: AuthorizedStation,
    options?: CollectionWriteOptions,
  ): Promise<void> {
    const checkpoint = options?.checkpoint;
    if (checkpoint) {
      await tx.$executeRaw`
        INSERT INTO "SoilCollectionCheckpoint" ("dataSourceId", "stationId", "historyThrough", "nextAttemptAt", "failureCount", "lastResult", "lastSuccessAt")
        VALUES (${station.dataSourceId}::uuid, ${station.id}::uuid, ${checkpoint.resumeAt?.toISOString() ?? null}::timestamptz,
          ${checkpoint.nextAttemptAt.toISOString()}::timestamptz, ${checkpoint.failed ? 1 : 0}, ${checkpoint.outcome}, ${checkpoint.successfulFetchAt?.toISOString() ?? null}::timestamptz)
        ON CONFLICT ("stationId") DO UPDATE SET
          "historyThrough" = COALESCE(EXCLUDED."historyThrough", "SoilCollectionCheckpoint"."historyThrough"),
          "nextAttemptAt" = EXCLUDED."nextAttemptAt",
          "failureCount" = CASE WHEN ${checkpoint.failed ?? false} THEN LEAST("SoilCollectionCheckpoint"."failureCount" + 1, 30) ELSE 0 END,
          "lastResult" = EXCLUDED."lastResult", "lastSuccessAt" = COALESCE(EXCLUDED."lastSuccessAt", "SoilCollectionCheckpoint"."lastSuccessAt")`;
    }
    await this.checkLease(tx, options);
  }

  private async writeReading(
    tx: Prisma.TransactionClient,
    station: AuthorizedStation,
    field: NormalizedLatestSoil['fields'][number],
    fetchedAt: Date,
    origin: 'latest' | 'rawHistory',
    allowNew: boolean,
  ): Promise<void> {
    const observedAt = new Date(field.observedAt);
    await tx.$executeRaw`
      INSERT INTO "SoilReading" ("dataSourceId", "stationId", field, "observedAt", value, "fetchedAt", "lastFetchedAt", origin)
      SELECT ${station.dataSourceId}::uuid, ${station.id}::uuid, ${field.field}, ${observedAt.toISOString()}::timestamptz,
        ${field.value}, ${fetchedAt.toISOString()}::timestamptz, ${fetchedAt.toISOString()}::timestamptz, ${origin}
      WHERE ${allowNew} OR EXISTS (SELECT 1 FROM "SoilReading" r WHERE r."dataSourceId" = ${station.dataSourceId}::uuid
        AND r."stationId" = ${station.id}::uuid AND r.field = ${field.field} AND r."observedAt" = ${observedAt.toISOString()}::timestamptz)
      ON CONFLICT ("dataSourceId", "stationId", field, "observedAt") DO UPDATE
      SET value = EXCLUDED.value,
        "fetchedAt" = CASE WHEN "SoilReading".value <> EXCLUDED.value THEN EXCLUDED."fetchedAt" ELSE "SoilReading"."fetchedAt" END,
        origin = CASE WHEN "SoilReading".value <> EXCLUDED.value THEN EXCLUDED.origin ELSE "SoilReading".origin END,
        "lastFetchedAt" = EXCLUDED."lastFetchedAt",
        revision = "SoilReading".revision + CASE WHEN "SoilReading".value <> EXCLUDED.value THEN 1 ELSE 0 END
      WHERE EXCLUDED."lastFetchedAt" > "SoilReading"."lastFetchedAt"`;
    await tx.$executeRaw`
      INSERT INTO "SoilLatestReading" ("dataSourceId", "stationId", field, "observedAt", value, "fetchedAt", "lastFetchedAt", origin)
      VALUES (${station.dataSourceId}::uuid, ${station.id}::uuid, ${field.field}, ${observedAt.toISOString()}::timestamptz,
        ${field.value}, ${fetchedAt.toISOString()}::timestamptz, ${fetchedAt.toISOString()}::timestamptz, ${origin})
      ON CONFLICT ("dataSourceId", "stationId", field) DO UPDATE
      SET value = EXCLUDED.value, "observedAt" = EXCLUDED."observedAt",
        "fetchedAt" = CASE WHEN "SoilLatestReading"."observedAt" <> EXCLUDED."observedAt" OR "SoilLatestReading".value <> EXCLUDED.value THEN EXCLUDED."fetchedAt" ELSE "SoilLatestReading"."fetchedAt" END,
        origin = CASE WHEN "SoilLatestReading"."observedAt" <> EXCLUDED."observedAt" OR "SoilLatestReading".value <> EXCLUDED.value THEN EXCLUDED.origin ELSE "SoilLatestReading".origin END,
        "lastFetchedAt" = EXCLUDED."lastFetchedAt",
        revision = "SoilLatestReading".revision + CASE WHEN "SoilLatestReading".value <> EXCLUDED.value THEN 1 ELSE 0 END
      WHERE EXCLUDED."observedAt" > "SoilLatestReading"."observedAt"
        OR (EXCLUDED."observedAt" = "SoilLatestReading"."observedAt"
          AND EXCLUDED."lastFetchedAt" > "SoilLatestReading"."lastFetchedAt")`;
  }
}
