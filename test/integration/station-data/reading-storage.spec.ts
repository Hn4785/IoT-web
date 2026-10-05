import { readFileSync } from 'node:fs';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createTestPrismaClient, prepareTestDatabase } from '../../helpers/database.js';

describe('durable soil storage boundaries', () => {
  const prisma = createTestPrismaClient();
  let stationId: string;
  const sourceId = '00000000-0000-0000-0000-000000000001';
  const observedAt = new Date('2026-10-01T00:00:00.000Z');

  beforeAll(async () => {
    await prepareTestDatabase();
    const farm = await prisma.farm.create({ data: { name: 'Durable storage test' } });
    const plot = await prisma.plot.create({ data: { farmId: farm.id, name: 'Plot' } });
    const station = await prisma.station.create({
      data: { plotId: plot.id, name: 'Node', upstreamCode: 'STORE01', dataSourceId: sourceId },
    });
    stationId = station.id;
  });
  afterAll(() => prisma.$disconnect());

  it('rejects duplicate observation identities and cross-source station writes', async () => {
    await prisma.$executeRaw`
      INSERT INTO "SoilReading" ("dataSourceId", "stationId", field, "observedAt", value, "fetchedAt", "lastFetchedAt", origin)
      VALUES (${sourceId}::uuid, ${stationId}::uuid, 'moisture', ${observedAt}, 43.123456789,
        ${observedAt}, ${observedAt}, 'latest')`;
    await expect(prisma.$executeRaw`
      INSERT INTO "SoilReading" ("dataSourceId", "stationId", field, "observedAt", value, "fetchedAt", "lastFetchedAt", origin)
      VALUES (${sourceId}::uuid, ${stationId}::uuid, 'moisture', ${observedAt}, 42,
        ${observedAt}, ${observedAt}, 'latest')`).rejects.toThrow();
    const other = await prisma.dataSource.create({
      data: {
        name: 'Other',
        baseUrl: 'https://example.invalid',
        kind: 'SYSTEM',
        connectionStatus: 'FAILED',
        lastCheckedAt: observedAt,
      },
    });
    await expect(prisma.$executeRaw`
      INSERT INTO "SoilReading" ("dataSourceId", "stationId", field, "observedAt", value, "fetchedAt", "lastFetchedAt", origin)
      VALUES (${other.id}::uuid, ${stationId}::uuid, 'ph', ${observedAt}, 7,
        ${observedAt}, ${observedAt}, 'latest')`).rejects.toThrow();
  });

  it('keeps the snapshot when retained raw history is deleted without rounding readings', async () => {
    await prisma.$executeRaw`
      INSERT INTO "SoilLatestReading" ("dataSourceId", "stationId", field, "observedAt", value, "fetchedAt", "lastFetchedAt", origin)
      VALUES (${sourceId}::uuid, ${stationId}::uuid, 'moisture', ${observedAt}, 43.123456789,
        ${observedAt}, ${observedAt}, 'latest')`;
    await prisma.$executeRaw`DELETE FROM "SoilReading" WHERE "stationId" = ${stationId}::uuid`;
    const snapshots = await prisma.$queryRaw<{ value: number }[]>`
      SELECT value FROM "SoilLatestReading" WHERE "stationId" = ${stationId}::uuid`;
    expect(snapshots).toEqual([{ value: 43.123456789 }]);
  });

  it('rejects nonfinite values and fields outside the soil contract', async () => {
    await prisma.$executeRaw`
      INSERT INTO "SoilReading" ("dataSourceId", "stationId", field, "observedAt", value, "fetchedAt", "lastFetchedAt", origin)
      VALUES (${sourceId}::uuid, ${stationId}::uuid, 'ph', ${observedAt}, 7,
        ${observedAt}, ${observedAt}, 'latest')`;
    let offset = 0;
    for (const [field, value] of [
      ['ph', 'NaN'],
      ['ph', 'Infinity'],
      ['unknown', '4'],
    ]) {
      const invalidTime = new Date(observedAt.getTime() + ++offset);
      await expect(prisma.$executeRaw`
        INSERT INTO "SoilReading" ("dataSourceId", "stationId", field, "observedAt", value, "fetchedAt", "lastFetchedAt", origin)
        VALUES (${sourceId}::uuid, ${stationId}::uuid, ${field}, ${invalidTime}, ${value}::float8,
          ${observedAt}, ${observedAt}, 'latest')`).rejects.toThrow();
      await expect(prisma.$executeRaw`
        INSERT INTO "SoilLatestReading" ("dataSourceId", "stationId", field, "observedAt", value, "fetchedAt", "lastFetchedAt", origin)
        VALUES (${sourceId}::uuid, ${stationId}::uuid, ${field}, ${invalidTime}, ${value}::float8,
          ${observedAt}, ${observedAt}, 'latest')`).rejects.toThrow();
    }
  });

  it('backfills fetch generations without changing existing captures or values', async () => {
    const migration = readFileSync(
      new URL(
        '../../../prisma/migrations/20261005135000_soil_fetch_generation/migration.sql',
        import.meta.url,
      ),
      'utf8',
    );
    const statements = migration
      .replace(/^--.*$/gm, '')
      .split(';')
      .map((statement) => statement.trim())
      .filter((statement) => statement && statement !== 'BEGIN' && statement !== 'COMMIT');
    await prisma.$transaction(async (tx) => {
      // Connection-local legacy tables shadow the real tables only in this transaction.
      await tx.$executeRaw`CREATE TEMP TABLE "SoilReading" ("fetchedAt" timestamptz(3) NOT NULL, value double precision NOT NULL) ON COMMIT DROP`;
      await tx.$executeRaw`CREATE TEMP TABLE "SoilLatestReading" ("fetchedAt" timestamptz(3) NOT NULL, value double precision NOT NULL) ON COMMIT DROP`;
      await tx.$executeRaw`INSERT INTO "SoilReading" VALUES (${observedAt}, 43.123456789)`;
      await tx.$executeRaw`INSERT INTO "SoilLatestReading" VALUES (${observedAt}, 43.123456789)`;
      for (const statement of statements) await tx.$executeRawUnsafe(statement);
      const expected = [{ fetchedAt: observedAt, lastFetchedAt: observedAt, value: 43.123456789 }];
      expect(await tx.$queryRaw`SELECT * FROM "SoilReading"`).toEqual(expected);
      expect(await tx.$queryRaw`SELECT * FROM "SoilLatestReading"`).toEqual(expected);
      expect(
        await tx.$queryRaw`
        SELECT attnotnull FROM pg_attribute
        WHERE attrelid IN ('pg_temp."SoilReading"'::regclass, 'pg_temp."SoilLatestReading"'::regclass)
          AND attname = 'lastFetchedAt'`,
      ).toEqual([{ attnotnull: true }, { attnotnull: true }]);
    });
  });
});
