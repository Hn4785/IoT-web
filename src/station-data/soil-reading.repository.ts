import { Injectable } from '@nestjs/common';

import { PrismaService } from '../database/prisma.service.js';
import { AppError } from '../common/errors/app-error.js';
import type { Prisma } from '../generated/prisma/client.js';
import type { NormalizedLatestSoil, SoilField } from './station-data.contracts.js';
import type { AuthorizedStation } from './station.repository.js';
import type { RawHistoryBatch } from './raw-history.js';

@Injectable()
export class SoilReadingRepository {
  constructor(private readonly prisma: PrismaService) {}

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

  async ingestLatest(station: AuthorizedStation, reading: NormalizedLatestSoil): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      // Source removal takes the same row lock, fencing responses already in flight.
      const source = await tx.$queryRaw<{ id: string }[]>`
        SELECT id FROM "DataSource" WHERE id = ${station.dataSourceId}::uuid
          AND "removedAt" IS NULL FOR UPDATE`;
      if (source.length !== 1) throw new AppError('NOT_FOUND', 404, 'Resource not found');
      for (const field of reading.fields) {
        await this.writeReading(tx, station, field, new Date(reading.fetchedAt), 'latest');
      }
    });
  }

  async ingestHistory(
    station: AuthorizedStation,
    batch: RawHistoryBatch,
    fetchedAt: Date,
    coverage?: { begin: Date; end: Date },
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const source = await tx.$queryRaw<{ id: string }[]>`
        SELECT id FROM "DataSource" WHERE id = ${station.dataSourceId}::uuid
          AND "removedAt" IS NULL FOR UPDATE`;
      if (source.length !== 1) throw new AppError('NOT_FOUND', 404, 'Resource not found');
      if (batch.readings.length) {
        const payload = JSON.stringify(batch.readings);
        await tx.$executeRaw`
          INSERT INTO "SoilReading" ("dataSourceId", "stationId", field, "observedAt", value, "fetchedAt", origin)
          SELECT ${station.dataSourceId}::uuid, ${station.id}::uuid, field, "observedAt", value, ${fetchedAt.toISOString()}::timestamptz, 'rawHistory'
          FROM jsonb_to_recordset(${payload}::jsonb) AS incoming(field text, value double precision, "observedAt" timestamptz)
          ON CONFLICT ("dataSourceId", "stationId", field, "observedAt") DO UPDATE
          SET value = EXCLUDED.value, "fetchedAt" = EXCLUDED."fetchedAt", origin = EXCLUDED.origin,
            revision = "SoilReading".revision + CASE WHEN "SoilReading".value <> EXCLUDED.value THEN 1 ELSE 0 END
          WHERE EXCLUDED."fetchedAt" > "SoilReading"."fetchedAt"`;
        await tx.$executeRaw`
          INSERT INTO "SoilLatestReading" ("dataSourceId", "stationId", field, "observedAt", value, "fetchedAt", origin)
          SELECT DISTINCT ON (field) ${station.dataSourceId}::uuid, ${station.id}::uuid, field, "observedAt", value, ${fetchedAt.toISOString()}::timestamptz, 'rawHistory'
          FROM jsonb_to_recordset(${payload}::jsonb) AS incoming(field text, value double precision, "observedAt" timestamptz)
          ORDER BY field, "observedAt" DESC
          ON CONFLICT ("dataSourceId", "stationId", field) DO UPDATE
          SET value = EXCLUDED.value, "observedAt" = EXCLUDED."observedAt",
            "fetchedAt" = EXCLUDED."fetchedAt", origin = EXCLUDED.origin,
            revision = "SoilLatestReading".revision + CASE WHEN "SoilLatestReading".value <> EXCLUDED.value THEN 1 ELSE 0 END
          WHERE EXCLUDED."observedAt" > "SoilLatestReading"."observedAt"
            OR (EXCLUDED."observedAt" = "SoilLatestReading"."observedAt"
              AND EXCLUDED."fetchedAt" > "SoilLatestReading"."fetchedAt")`;
      }
      if (coverage) {
        for (const field of batch.completeFields) {
          await tx.$executeRaw`
            INSERT INTO "SoilHistoryCoverage" ("dataSourceId", "stationId", field, begin, "end", "fetchedAt")
            VALUES (${station.dataSourceId}::uuid, ${station.id}::uuid, ${field}, ${coverage.begin.toISOString()}::timestamptz, ${coverage.end.toISOString()}::timestamptz, ${fetchedAt.toISOString()}::timestamptz)
            ON CONFLICT ("dataSourceId", "stationId", field, begin) DO UPDATE
            SET "end" = GREATEST("SoilHistoryCoverage"."end", EXCLUDED."end"),
              "fetchedAt" = GREATEST("SoilHistoryCoverage"."fetchedAt", EXCLUDED."fetchedAt")`;
        }
      }
    });
  }

  private async writeReading(
    tx: Prisma.TransactionClient,
    station: AuthorizedStation,
    field: NormalizedLatestSoil['fields'][number],
    fetchedAt: Date,
    origin: 'latest' | 'rawHistory',
  ): Promise<void> {
    const observedAt = new Date(field.observedAt);
    await tx.$executeRaw`
      INSERT INTO "SoilReading" ("dataSourceId", "stationId", field, "observedAt", value, "fetchedAt", origin)
      VALUES (${station.dataSourceId}::uuid, ${station.id}::uuid, ${field.field}, ${observedAt.toISOString()}::timestamptz,
        ${field.value}, ${fetchedAt.toISOString()}::timestamptz, ${origin})
      ON CONFLICT ("dataSourceId", "stationId", field, "observedAt") DO UPDATE
      SET value = EXCLUDED.value, "fetchedAt" = EXCLUDED."fetchedAt", origin = EXCLUDED.origin,
        revision = "SoilReading".revision + CASE WHEN "SoilReading".value <> EXCLUDED.value THEN 1 ELSE 0 END
      WHERE EXCLUDED."fetchedAt" > "SoilReading"."fetchedAt"`;
    await tx.$executeRaw`
      INSERT INTO "SoilLatestReading" ("dataSourceId", "stationId", field, "observedAt", value, "fetchedAt", origin)
      VALUES (${station.dataSourceId}::uuid, ${station.id}::uuid, ${field.field}, ${observedAt.toISOString()}::timestamptz,
        ${field.value}, ${fetchedAt.toISOString()}::timestamptz, ${origin})
      ON CONFLICT ("dataSourceId", "stationId", field) DO UPDATE
      SET value = EXCLUDED.value, "observedAt" = EXCLUDED."observedAt",
        "fetchedAt" = EXCLUDED."fetchedAt", origin = EXCLUDED.origin,
        revision = "SoilLatestReading".revision + CASE WHEN "SoilLatestReading".value <> EXCLUDED.value THEN 1 ELSE 0 END
      WHERE EXCLUDED."observedAt" > "SoilLatestReading"."observedAt"
        OR (EXCLUDED."observedAt" = "SoilLatestReading"."observedAt"
          AND EXCLUDED."fetchedAt" > "SoilLatestReading"."fetchedAt")`;
  }
}
