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
      INSERT INTO "SoilReading" ("dataSourceId", "stationId", field, "observedAt", value, "fetchedAt", origin)
      VALUES (${sourceId}::uuid, ${stationId}::uuid, 'moisture', ${observedAt}, 43.123456789,
        ${observedAt}, 'latest')`;
    await expect(prisma.$executeRaw`
      INSERT INTO "SoilReading" ("dataSourceId", "stationId", field, "observedAt", value, "fetchedAt", origin)
      VALUES (${sourceId}::uuid, ${stationId}::uuid, 'moisture', ${observedAt}, 42,
        ${observedAt}, 'latest')`).rejects.toThrow();
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
      INSERT INTO "SoilReading" ("dataSourceId", "stationId", field, "observedAt", value, "fetchedAt", origin)
      VALUES (${other.id}::uuid, ${stationId}::uuid, 'ph', ${observedAt}, 7,
        ${observedAt}, 'latest')`).rejects.toThrow();
  });

  it('keeps the snapshot when retained raw history is deleted without rounding readings', async () => {
    await prisma.$executeRaw`
      INSERT INTO "SoilLatestReading" ("dataSourceId", "stationId", field, "observedAt", value, "fetchedAt", origin)
      VALUES (${sourceId}::uuid, ${stationId}::uuid, 'moisture', ${observedAt}, 43.123456789,
        ${observedAt}, 'latest')`;
    await prisma.$executeRaw`DELETE FROM "SoilReading" WHERE "stationId" = ${stationId}::uuid`;
    const snapshots = await prisma.$queryRaw<{ value: number }[]>`
      SELECT value FROM "SoilLatestReading" WHERE "stationId" = ${stationId}::uuid`;
    expect(snapshots).toEqual([{ value: 43.123456789 }]);
  });

  it('rejects nonfinite values and fields outside the soil contract', async () => {
    await prisma.$executeRaw`
      INSERT INTO "SoilReading" ("dataSourceId", "stationId", field, "observedAt", value, "fetchedAt", origin)
      VALUES (${sourceId}::uuid, ${stationId}::uuid, 'ph', ${observedAt}, 7,
        ${observedAt}, 'latest')`;
    let offset = 0;
    for (const [field, value] of [
      ['ph', 'NaN'],
      ['ph', 'Infinity'],
      ['unknown', '4'],
    ]) {
      const invalidTime = new Date(observedAt.getTime() + ++offset);
      await expect(prisma.$executeRaw`
        INSERT INTO "SoilReading" ("dataSourceId", "stationId", field, "observedAt", value, "fetchedAt", origin)
        VALUES (${sourceId}::uuid, ${stationId}::uuid, ${field}, ${invalidTime}, ${value}::float8,
          ${observedAt}, 'latest')`).rejects.toThrow();
      await expect(prisma.$executeRaw`
        INSERT INTO "SoilLatestReading" ("dataSourceId", "stationId", field, "observedAt", value, "fetchedAt", origin)
        VALUES (${sourceId}::uuid, ${stationId}::uuid, ${field}, ${invalidTime}, ${value}::float8,
          ${observedAt}, 'latest')`).rejects.toThrow();
    }
  });
});
