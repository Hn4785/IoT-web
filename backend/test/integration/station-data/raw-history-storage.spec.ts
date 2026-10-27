import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { PrismaService } from '../../../src/database/prisma.service.js';
import { SoilReadingRepository } from '../../../src/station-data/soil-reading.repository.js';
import type { AuthorizedStation } from '../../../src/station-data/station.repository.js';
import { createTestPrismaClient, prepareTestDatabase } from '../../helpers/database.js';

describe('durable raw history batches', () => {
  const prisma = createTestPrismaClient();
  const repository = new SoilReadingRepository(prisma as PrismaService);
  let station: AuthorizedStation;
  const begin = new Date('2026-10-01T00:00:00Z');
  const end = new Date('2026-10-01T01:00:00Z');
  beforeAll(async () => {
    await prepareTestDatabase();
    const farm = await prisma.farm.create({ data: { name: 'History fixture' } });
    const plot = await prisma.plot.create({ data: { farmId: farm.id, name: 'Plot' } });
    const row = await prisma.station.create({
      data: { plotId: plot.id, name: 'Node', upstreamCode: 'HISTORY01' },
    });
    station = { ...row, code: row.upstreamCode, farmId: farm.id };
  });
  afterAll(() => prisma.$disconnect());

  it('imports a full raw page in bulk and deduplicates overlap without rolling latest backwards', async () => {
    const batch = {
      readings: Array.from({ length: 5000 }, (_, i) => ({
        field: 'moisture' as const,
        value: i / 100,
        observedAt: new Date(begin.getTime() + i).toISOString(),
      })),
      completeFields: ['moisture' as const],
      rawCount: 5000,
      lastTimestamp: begin.getTime() + 4999,
    };
    await repository.ingestHistory(station, batch, end);
    await repository.ingestHistory(station, batch, end);
    expect(await prisma.soilReading.count()).toBe(5000);
    expect((await repository.getLatest(station, ['moisture']))?.fields[0]?.value).toBe(49.99);
    expect(await prisma.soilHistoryCoverage.count()).toBe(0);
    await repository.ingestHistory(
      station,
      { ...batch, readings: batch.readings.slice(0, 1) },
      new Date(end.getTime() + 1),
      { begin, end },
    );
    expect((await repository.getLatest(station, ['moisture']))?.fields[0]?.value).toBe(49.99);
    expect(await prisma.soilHistoryCoverage.count()).toBe(1);
  });
  it('records explicit empty window coverage without fabricating a sample', async () => {
    const before = await prisma.soilReading.count();
    await repository.ingestHistory(
      station,
      { readings: [], completeFields: ['temperature'], rawCount: 0, lastTimestamp: null },
      end,
      { begin, end },
    );
    expect(await prisma.soilReading.count()).toBe(before);
    expect(await repository.getLatest(station, ['temperature'])).toBeNull();
    expect(await prisma.soilHistoryCoverage.count({ where: { field: 'temperature' } })).toBe(1);
  });
  it('reads last-known times unchanged in a non-UTC database session', async () => {
    await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SET LOCAL TIME ZONE 'Asia/Saigon'`;
      const result = await new SoilReadingRepository(tx as unknown as PrismaService).getLatest(
        station,
        ['moisture'],
      );
      expect(result?.fields[0]?.observedAt).toBe('2026-10-01T00:00:04.999Z');
      expect(result?.fetchedAt).toBe(end.toISOString());
    });
  });
});
