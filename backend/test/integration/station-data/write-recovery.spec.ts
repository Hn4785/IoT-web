import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import type { PrismaService } from '../../../src/database/prisma.service.js';
import type { Prisma } from '../../../src/generated/prisma/client.js';
import { SoilReadingRepository } from '../../../src/station-data/soil-reading.repository.js';
import type { AuthorizedStation } from '../../../src/station-data/station.repository.js';
import { createTestPrismaClient, prepareTestDatabase } from '../../helpers/database.js';

describe('injected database write and purge recovery', () => {
  const prisma = createTestPrismaClient();
  const repository = new SoilReadingRepository(prisma as PrismaService);
  const now = new Date();
  let station: AuthorizedStation;
  beforeEach(async () => {
    await prepareTestDatabase();
    const farm = await prisma.farm.create({ data: { name: 'Write recovery' } });
    const plot = await prisma.plot.create({ data: { farmId: farm.id, name: 'Fixture' } });
    const row = await prisma.station.create({
      data: { plotId: plot.id, name: 'Fixture', upstreamCode: 'WRITE01' },
    });
    station = { ...row, code: row.upstreamCode, farmId: farm.id };
    await repository.ingestLatest(station, {
      station,
      fetchedAt: now.toISOString(),
      fields: [
        {
          field: 'moisture',
          value: 40,
          observedAt: new Date(now.getTime() - 91 * 86_400_000).toISOString(),
        },
      ],
    });
  });
  afterAll(() => prisma.$disconnect());
  const broken = (failure: 'snapshot' | 'coverage') =>
    new SoilReadingRepository({
      $transaction: (work: (tx: Prisma.TransactionClient) => Promise<unknown>) =>
        prisma.$transaction((tx) =>
          work(
            new Proxy(tx, {
              get(target, property) {
                if (property === '$executeRaw' && failure === 'snapshot')
                  return async (sql: TemplateStringsArray, ...values: unknown[]) => {
                    if (sql.join('').includes('INSERT INTO "SoilLatestReading"'))
                      throw new Error('Injected snapshot write failure');
                    return target.$executeRaw(sql, ...values);
                  };
                if (property === '$queryRaw' && failure === 'coverage')
                  return () => {
                    throw new Error('Injected coverage purge failure');
                  };
                return Reflect.get(target, property) as unknown;
              },
            }),
          ),
        ),
    } as unknown as PrismaService);
  it('rolls back a partial raw write and preserves snapshot/checkpoint before a successful retry', async () => {
    await prisma.evaluatorLease.create({
      data: {
        name: 'soil-collector',
        holderId: 'recovery-generation',
        expiresAt: new Date(Date.now() + 60_000),
      },
    });
    const value = {
      station,
      fetchedAt: now.toISOString(),
      fields: [{ field: 'moisture' as const, value: 55, observedAt: now.toISOString() }],
    };
    const options = {
      holderId: 'recovery-generation',
      checkpoint: { resumeAt: now, nextAttemptAt: now, outcome: 'success' as const },
    };
    await expect(broken('snapshot').ingestLatest(station, value, options)).rejects.toThrow(
      'Injected snapshot write failure',
    );
    expect(await prisma.soilReading.count()).toBe(1);
    expect((await repository.getLatest(station, ['moisture']))?.fields[0]?.value).toBe(40);
    expect(await prisma.soilCollectionCheckpoint.count()).toBe(0);
    await repository.ingestLatest(station, value, options);
    expect(await prisma.soilReading.count()).toBe(2);
    expect((await repository.getLatest(station, ['moisture']))?.fields[0]?.value).toBe(55);
    expect(await prisma.soilCollectionCheckpoint.findFirst()).toMatchObject({
      historyThrough: now,
    });
  });
  it('rolls back a partial purge and leaves the last-known snapshot unchanged on recovery', async () => {
    await expect(broken('coverage').prune(now)).rejects.toThrow('Injected coverage purge failure');
    expect(await prisma.soilReading.count()).toBe(1);
    expect((await repository.getLatest(station, ['moisture']))?.fields[0]?.value).toBe(40);
    expect(await repository.prune(now)).toMatchObject({ readingsPurged: 1 });
    expect(await prisma.soilReading.count()).toBe(0);
    expect((await repository.getLatest(station, ['moisture']))?.fields[0]?.value).toBe(40);
  });
});
