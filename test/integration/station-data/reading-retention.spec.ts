import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { PrismaService } from '../../../src/database/prisma.service.js';
import { SoilReadingRepository } from '../../../src/station-data/soil-reading.repository.js';
import { StoredHistoryRepository } from '../../../src/station-data/stored-history.repository.js';
import { parseSoilHistoryQuery } from '../../../src/station-data/station-data.contracts.js';
import type { AuthorizedStation } from '../../../src/station-data/station.repository.js';
import { createTestPrismaClient, prepareTestDatabase } from '../../helpers/database.js';

describe('bounded 90-day raw retention', () => {
  const prisma = createTestPrismaClient();
  const repository = new SoilReadingRepository(prisma as PrismaService);
  const now = new Date();
  const day = 86_400_000;
  let station: AuthorizedStation;
  beforeAll(async () => {
    await prepareTestDatabase();
    const farm = await prisma.farm.create({ data: { name: 'Retention' } });
    const plot = await prisma.plot.create({ data: { farmId: farm.id, name: 'Plot' } });
    const row = await prisma.station.create({
      data: { plotId: plot.id, name: 'Node', upstreamCode: 'KEEP01' },
    });
    station = { ...row, code: row.upstreamCode, farmId: farm.id };
    await repository.ingestLatest(station, {
      station,
      fetchedAt: now.toISOString(),
      fields: [
        {
          field: 'moisture',
          value: 40,
          observedAt: new Date(now.getTime() - 91 * day).toISOString(),
        },
        {
          field: 'temperature',
          value: 25,
          observedAt: new Date(now.getTime() - 92 * day).toISOString(),
        },
        { field: 'ph', value: 7, observedAt: new Date(now.getTime() - day).toISOString() },
      ],
    });
    await repository.ingestHistory(
      station,
      { readings: [], completeFields: ['ph'], rawCount: 0, lastTimestamp: null },
      now,
      { begin: new Date(now.getTime() - 91 * day), end: now },
    );
  });
  afterAll(() => prisma.$disconnect());
  it('does not serve expired raw history or stale coverage while bounded pruning catches up', async () => {
    const begin = new Date(now.getTime() - 92 * day).toISOString();
    const end = new Date(now.getTime() - 91 * day).toISOString();
    const query = parseSoilHistoryQuery({ begin, end, fields: 'temperature,moisture' });
    const stored = new StoredHistoryRepository(prisma as PrismaService, repository);
    expect(await stored.getHistory(station, query)).toBeNull();
    expect((await stored.getCoverage(station, query)).status).toBe('unknown');
    expect(await prisma.soilReading.count()).toBe(3);
  });
  it('purges only a bounded raw batch while preserving independent latest snapshots', async () => {
    expect(await repository.prune(now, 1)).toMatchObject({ readingsPurged: 1 });
    expect(await prisma.soilReading.count()).toBe(2);
    expect(
      (await repository.getLatest(station, ['moisture', 'temperature', 'ph']))?.fields,
    ).toHaveLength(3);
    expect(await repository.prune(now, 1)).toMatchObject({ readingsPurged: 1 });
    expect(await prisma.soilReading.count()).toBe(1);
    expect(await prisma.soilLatestReading.count()).toBe(3);
  });
  it('clips proven coverage to retention without deleting credentials or audit/lifecycle data', async () => {
    const coverage = await prisma.soilHistoryCoverage.findFirst();
    expect(coverage?.begin).toEqual(new Date(now.getTime() - 90 * day));
    expect(coverage?.end).toEqual(now);
    expect(await prisma.dataSource.count()).toBe(1);
    expect(await prisma.evaluatorLease.count()).toBe(0);
  });
});
