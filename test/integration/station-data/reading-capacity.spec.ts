import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { PrismaService } from '../../../src/database/prisma.service.js';
import { SoilReadingRepository } from '../../../src/station-data/soil-reading.repository.js';
import type { AuthorizedStation } from '../../../src/station-data/station.repository.js';
import { createTestPrismaClient, prepareTestDatabase } from '../../helpers/database.js';
import { makeTestRuntimeConfig } from '../../helpers/runtime-config.js';

describe('raw capacity preserves snapshots and existing data', () => {
  const prisma = createTestPrismaClient();
  const repository = new SoilReadingRepository(
    prisma as PrismaService,
    makeTestRuntimeConfig({ soilRawStationLimit: 2, soilRawGlobalLimit: 3 }),
  );
  const stations: AuthorizedStation[] = [];
  const now = new Date();
  const reading = (station: AuthorizedStation, i: number) => ({
    station,
    fields: [
      {
        field: 'moisture' as const,
        value: i,
        observedAt: new Date(now.getTime() + i).toISOString(),
      },
    ],
    fetchedAt: now.toISOString(),
  });
  beforeAll(async () => {
    await prepareTestDatabase();
    const farm = await prisma.farm.create({ data: { name: 'Capacity' } });
    const plot = await prisma.plot.create({ data: { farmId: farm.id, name: 'Plot' } });
    for (const code of ['CAP01', 'CAP02']) {
      const row = await prisma.station.create({
        data: { plotId: plot.id, name: code, upstreamCode: code },
      });
      stations.push({ ...row, code, farmId: farm.id });
    }
  });
  afterAll(() => prisma.$disconnect());
  it('stops new raw rows at station/global ceilings but still updates latest snapshots', async () => {
    const first = stations[0];
    const second = stations[1];
    if (!first || !second) throw new Error('Fixture missing');
    await repository.ingestLatest(first, reading(first, 1));
    await repository.ingestLatest(first, reading(first, 2));
    expect(await repository.ingestLatest(first, reading(first, 3))).toMatchObject({
      storageLimited: true,
    });
    expect(await prisma.soilReading.count({ where: { stationId: first.id } })).toBe(2);
    expect((await repository.getLatest(first, ['moisture']))?.fields[0]?.value).toBe(3);
    await repository.ingestLatest(second, reading(second, 1));
    expect(await repository.ingestLatest(second, reading(second, 2))).toMatchObject({
      storageLimited: true,
    });
    expect(await prisma.soilReading.count()).toBe(3);
  });
  it('allows existing-identity corrections at capacity without claiming uncaptured history coverage', async () => {
    const station = stations[0];
    if (!station) throw new Error('Fixture missing');
    const original = reading(station, 1);
    await repository.ingestLatest(station, {
      ...original,
      fetchedAt: new Date(now.getTime() + 100).toISOString(),
      fields: original.fields.map((field) => ({ ...field, value: 99 })),
    });
    expect(
      (
        await prisma.soilReading.findFirst({
          where: { stationId: station.id, observedAt: new Date(now.getTime() + 1) },
        })
      )?.value,
    ).toBe(99);
    const begin = new Date(now.getTime() + 4);
    const end = new Date(now.getTime() + 5);
    expect(
      await repository.ingestHistory(
        station,
        {
          readings: reading(station, 4).fields,
          completeFields: ['moisture'],
          rawCount: 1,
          lastTimestamp: begin.getTime(),
        },
        end,
        { begin, end },
      ),
    ).toMatchObject({ storageLimited: true });
    expect(await prisma.soilHistoryCoverage.count()).toBe(0);
    expect(await prisma.soilReading.count()).toBe(3);
  });
});
