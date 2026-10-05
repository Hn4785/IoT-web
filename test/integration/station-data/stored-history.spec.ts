import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { PrismaService } from '../../../src/database/prisma.service.js';
import { SoilReadingRepository } from '../../../src/station-data/soil-reading.repository.js';
import { StoredHistoryRepository } from '../../../src/station-data/stored-history.repository.js';
import { parseSoilHistoryQuery } from '../../../src/station-data/station-data.contracts.js';
import type { AuthorizedStation } from '../../../src/station-data/station.repository.js';
import { createTestPrismaClient, prepareTestDatabase } from '../../helpers/database.js';

describe('stored history pagination and coverage', () => {
  const prisma = createTestPrismaClient();
  const readings = new SoilReadingRepository(prisma as PrismaService);
  const repository = new StoredHistoryRepository(prisma as PrismaService, readings);
  const begin = new Date('2026-10-01T00:00:00Z');
  const end = new Date('2026-10-01T02:00:00Z');
  const query = (extra = {}) =>
    parseSoilHistoryQuery({
      begin: begin.toISOString(),
      end: end.toISOString(),
      fields: 'moisture,temperature',
      limit: 1,
      ...extra,
    });
  let station: AuthorizedStation;
  beforeAll(async () => {
    await prepareTestDatabase();
    const farm = await prisma.farm.create({ data: { name: 'Stored history' } });
    const plot = await prisma.plot.create({ data: { farmId: farm.id, name: 'Plot' } });
    const row = await prisma.station.create({
      data: { plotId: plot.id, name: 'Node', upstreamCode: 'STORED01' },
    });
    station = { ...row, farmId: farm.id, code: row.upstreamCode };
    const fields = ['moisture', 'temperature'] as const;
    const batch = {
      readings: [0, 1, 2].flatMap((i) =>
        fields.map((field) => ({
          field,
          value: i === 2 ? 100 : 10,
          observedAt: new Date(begin.getTime() + i * 60_000).toISOString(),
        })),
      ),
      completeFields: ['moisture' as const],
      rawCount: 3,
      lastTimestamp: begin.getTime() + 120_000,
    };
    await readings.ingestHistory(station, batch, end, { begin, end });
  });
  afterAll(() => prisma.$disconnect());
  it('paginates whole timestamp groups with query-bound, stored-origin cursors', async () => {
    const first = await repository.getHistory(station, query());
    expect(first).toMatchObject({
      dataOrigin: 'stored',
      isStale: true,
      coverage: { status: 'partial' },
      fetchedAt: end.toISOString(),
    });
    expect(first?.series).toHaveLength(2);
    expect(first?.series[0]?.points).toHaveLength(1);
    expect(first?.page.nextCursor).toBeTruthy();
    const next = await repository.getHistory(station, query({ cursor: first?.page.nextCursor }));
    expect(next?.series[0]?.points[0]?.observedAt).toBe('2026-10-01T00:01:00.000Z');
    await expect(
      repository.getHistory(station, query({ cursor: first?.page.nextCursor, limit: 2 })),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
  });
  it('aggregates the complete UTC bucket before applying page limits', async () => {
    const result = await repository.getHistory(
      station,
      query({ fields: 'moisture', interval: '1h', aggregate: 'mean' }),
    );
    expect(result?.series[0]?.points).toEqual([
      { observedAt: begin.toISOString(), value: 40, quality: 'good' },
    ]);
    expect(result?.coverage?.status).toBe('complete');
  });
  it('selects newest timestamp groups first for descending pages', async () => {
    const first = await repository.getHistory(station, query({ order: 'desc' }));
    expect(first?.series[0]?.points[0]?.observedAt).toBe('2026-10-01T00:02:00.000Z');
    const next = await repository.getHistory(
      station,
      query({ order: 'desc', cursor: first?.page.nextCursor }),
    );
    expect(next?.series[0]?.points[0]?.observedAt).toBe('2026-10-01T00:01:00.000Z');
  });
  it('never infers coverage from sample endpoints and does not fabricate empty data', async () => {
    const missing = await repository.getHistory(station, query({ fields: 'ph' }));
    expect(missing).toBeNull();
    await readings.ingestHistory(
      station,
      { readings: [], completeFields: ['ph'], rawCount: 0, lastTimestamp: null },
      end,
      { begin, end },
    );
    expect(await repository.getHistory(station, query({ fields: 'ph' }))).toMatchObject({
      series: [],
      coverage: { status: 'complete' },
    });
  });
  it('anchors daily bins to UTC even when PostgreSQL uses a non-UTC timezone', async () => {
    await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SET LOCAL TIME ZONE 'Asia/Saigon'`;
      const inTransaction = new StoredHistoryRepository(tx as unknown as PrismaService, readings);
      const result = await inTransaction.getHistory(
        station,
        query({
          fields: 'moisture',
          interval: '1d',
          aggregate: 'mean',
          end: '2026-10-01T23:59:59.999Z',
        }),
      );
      expect(result?.series[0]?.points[0]?.observedAt).toBe(begin.toISOString());
    });
  });
  it('withholds incomplete boundary buckets instead of publishing partial-hour averages', async () => {
    const result = await repository.getHistory(
      station,
      query({
        fields: 'moisture',
        interval: '1h',
        aggregate: 'mean',
        begin: '2026-10-01T00:00:30.000Z',
        end: '2026-10-01T00:02:00.000Z',
      }),
    );
    expect(result?.series).toEqual([]);
  });
});
