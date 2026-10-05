import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { PrismaService } from '../../../src/database/prisma.service.js';
import { SoilReadingRepository } from '../../../src/station-data/soil-reading.repository.js';
import { CollectionLeaseLostError } from '../../../src/station-data/collection-write.js';
import type { AuthorizedStation } from '../../../src/station-data/station.repository.js';
import { createTestPrismaClient, prepareTestDatabase } from '../../helpers/database.js';

describe('collection transaction fencing', () => {
  const prisma = createTestPrismaClient();
  const repository = new SoilReadingRepository(prisma as PrismaService);
  let station: AuthorizedStation;
  const holderId = 'collector-generation-1';
  const now = new Date();
  const sample = {
    station: { id: '', code: 'FENCE01', name: 'Node' },
    fields: [{ field: 'moisture' as const, value: 43, observedAt: now.toISOString() }],
    fetchedAt: now.toISOString(),
  };
  beforeAll(async () => {
    await prepareTestDatabase();
    const farm = await prisma.farm.create({ data: { name: 'Fence' } });
    const plot = await prisma.plot.create({ data: { farmId: farm.id, name: 'Plot' } });
    const row = await prisma.station.create({
      data: { plotId: plot.id, name: 'Node', upstreamCode: 'FENCE01' },
    });
    station = { ...row, code: row.upstreamCode, farmId: farm.id };
    sample.station.id = row.id;
  });
  afterAll(() => prisma.$disconnect());
  it('rejects a lost generation without changing readings or checkpoints', async () => {
    await prisma.evaluatorLease.create({
      data: {
        name: 'soil-collector',
        holderId: 'other-run',
        expiresAt: new Date(Date.now() + 60_000),
      },
    });
    await expect(
      repository.ingestLatest(station, sample, {
        holderId,
        checkpoint: { nextAttemptAt: now, outcome: 'success' },
      }),
    ).rejects.toBeInstanceOf(CollectionLeaseLostError);
    expect(await prisma.soilReading.count()).toBe(0);
    expect(await prisma.soilCollectionCheckpoint.count()).toBe(0);
  });
  it('commits a reading and inclusive resume checkpoint atomically', async () => {
    await prisma.evaluatorLease.update({
      where: { name: 'soil-collector' },
      data: { holderId, expiresAt: new Date(Date.now() + 60_000) },
    });
    await repository.ingestLatest(station, sample, {
      holderId,
      checkpoint: { resumeAt: now, nextAttemptAt: now, outcome: 'success', successfulFetchAt: now },
    });
    expect(await prisma.soilReading.count()).toBe(1);
    expect(
      await prisma.soilCollectionCheckpoint.findUnique({ where: { stationId: station.id } }),
    ).toMatchObject({ historyThrough: now, lastResult: 'success', failureCount: 0 });
  });
  it('rechecks real expiry after waiting for a source lock', async () => {
    let release = () => {};
    let locked = () => {};
    const ready = new Promise<void>((resolve) => {
      locked = resolve;
    });
    const hold = new Promise<void>((resolve) => {
      release = resolve;
    });
    const blocker = prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "DataSource" WHERE id = ${station.dataSourceId}::uuid FOR UPDATE`;
      locked();
      await hold;
    });
    await ready;
    await prisma.evaluatorLease.update({
      where: { name: 'soil-collector' },
      data: { expiresAt: new Date(Date.now() + 80) },
    });
    const attempt = repository.ingestLatest(
      station,
      { ...sample, fields: [{ observedAt: now.toISOString(), field: 'temperature', value: 25 }] },
      { holderId },
    );
    const rejected = expect(attempt).rejects.toBeInstanceOf(CollectionLeaseLostError);
    await new Promise((resolve) => setTimeout(resolve, 120));
    release();
    await blocker;
    await rejected;
    expect(await prisma.soilReading.count()).toBe(1);
  });
  it('uses the retention lock order before taking a station lock', async () => {
    await prisma.evaluatorLease.update({
      where: { name: 'soil-collector' },
      data: { expiresAt: new Date(Date.now() + 60_000) },
    });
    let attempt: Promise<unknown> | undefined;
    const retention = prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SET LOCAL statement_timeout = '800ms'`;
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(56010501)`;
      attempt = repository.ingestLatest(station, sample, { holderId });
      for (let i = 0; i < 40; i++) {
        const waiters = await tx.$queryRaw<
          { count: bigint }[]
        >`SELECT count(*) FROM pg_locks WHERE locktype = 'advisory' AND NOT granted`;
        if (Number(waiters[0]?.count ?? 0) > 0) break;
        await new Promise((resolve) => setTimeout(resolve, 10));
      }
      // Coverage clipping acquires this FK lock while holding the capacity/retention lock.
      await tx.$queryRaw`SELECT id FROM "Station" WHERE id = ${station.id}::uuid FOR KEY SHARE`;
    });
    const result = await retention.then(
      () => null,
      (error: unknown) => error,
    );
    await attempt;
    expect(result).toBeNull();
  });
});
