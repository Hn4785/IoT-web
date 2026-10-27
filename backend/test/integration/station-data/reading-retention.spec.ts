import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '../../../src/database/prisma.service.js';
import { SoilReadingRepository } from '../../../src/station-data/soil-reading.repository.js';
import { StoredHistoryRepository } from '../../../src/station-data/stored-history.repository.js';
import { parseSoilHistoryQuery } from '../../../src/station-data/station-data.contracts.js';
import type { AuthorizedStation } from '../../../src/station-data/station.repository.js';
import { createTestPrismaClient, prepareTestDatabase } from '../../helpers/database.js';

describe('bounded 90-day raw retention', () => {
  const prisma = createTestPrismaClient();
  const repository = new SoilReadingRepository(prisma as PrismaService);
  // Keep the cutoff inside a UTC hour so the boundary bucket is always incomplete.
  const now = new Date(Math.floor(Date.now() / 3_600_000) * 3_600_000 + 1_800_000);
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
  it('clips a crossing cutoff before/after purge and preserves actual credential/audit/alert records', async () => {
    const cutoff = now.getTime() - 90 * day;
    const user = await prisma.user.create({
      data: {
        email: 'soil-retention@example.test',
        displayName: 'Fixture',
        passwordHash: 'fixture-only',
        role: 'ADMIN',
      },
    });
    await prisma.apiKey.create({
      data: {
        ownerUserId: user.id,
        name: 'Fixture',
        prefix: 'retention-fixture',
        keyHash: 'test-only-retention-hash',
        expiresAt: new Date(now.getTime() + day),
      },
    });
    await prisma.securityAuditEvent.create({
      data: {
        actorUserId: user.id,
        action: 'fixture.retention',
        targetType: 'station',
        targetId: station.id,
        result: 'SUCCESS',
        requestId: 'soil-retention-fixture',
      },
    });
    const rule = await prisma.alertRule.create({
      data: {
        stationId: station.id,
        field: 'MOISTURE',
        unit: '%',
        metadataRevision: 'fixture:v1',
        condition: { operator: 'BELOW', threshold: 20 },
        severity: 'WARNING',
        isEnabled: false,
        evaluationStatus: 'DISABLED',
      },
    });
    const alert = await prisma.alert.create({
      data: {
        ruleId: rule.id,
        unresolvedRuleId: rule.id,
        status: 'OPEN',
        openedValue: 10,
        latestValue: 10,
        openedObservedAt: now,
        latestObservedAt: now,
      },
    });
    const event = await prisma.alertLifecycleEvent.create({
      data: { alertId: alert.id, type: 'OPENED', revision: 1, requestId: 'soil-retention-fixture' },
    });
    await prisma.inAppNotification.create({
      data: { lifecycleEventId: event.id, recipientUserId: user.id },
    });
    await prisma.notificationDeliveryJob.create({
      data: {
        lifecycleEventId: event.id,
        farmId: station.farmId,
        stationId: station.id,
        stationCode: station.code,
        stationName: station.name,
        field: 'MOISTURE',
        severity: 'WARNING',
        alertStatus: 'OPEN',
      },
    });
    const protectedRows = () =>
      Promise.all([
        prisma.user.findMany(),
        prisma.apiKey.findMany(),
        prisma.dataSource.findMany(),
        prisma.securityAuditEvent.findMany(),
        prisma.alertRule.findMany(),
        prisma.alert.findMany(),
        prisma.alertLifecycleEvent.findMany(),
        prisma.inAppNotification.findMany(),
        prisma.notificationDeliveryJob.findMany(),
      ]);
    const before = await protectedRows();
    await repository.ingestHistory(
      station,
      {
        readings: [
          { field: 'ph', value: 9, observedAt: new Date(cutoff - 1).toISOString() },
          { field: 'ph', value: 8, observedAt: new Date(cutoff + 60_000).toISOString() },
        ],
        completeFields: [],
        rawCount: 2,
        lastTimestamp: cutoff + 60_000,
      },
      now,
    );
    const stored = new StoredHistoryRepository(prisma as PrismaService, repository);
    const params = {
      fields: 'ph',
      begin: new Date(cutoff - 1_800_000).toISOString(),
      end: new Date(cutoff + 5_400_000).toISOString(),
    };
    const frozen = vi.spyOn(Date, 'now').mockReturnValue(now.getTime());
    try {
      const first = await stored.getHistory(station, parseSoilHistoryQuery(params));
      expect(first?.coverage).toEqual({
        status: 'partial',
        fields: [
          { field: 'ph', ranges: [{ begin: new Date(cutoff).toISOString(), end: params.end }] },
        ],
      });
      expect(first?.series[0]?.points).toEqual([
        { observedAt: new Date(cutoff + 60_000).toISOString(), value: 8, quality: 'good' },
      ]);
      expect(
        (
          await stored.getHistory(
            station,
            parseSoilHistoryQuery({ ...params, interval: '1h', aggregate: 'mean' }),
          )
        )?.series,
      ).toEqual([]);
      expect(await repository.prune(now, 1)).toMatchObject({ readingsPurged: 1 });
      expect(await stored.getHistory(station, parseSoilHistoryQuery(params))).toEqual(first);
    } finally {
      frozen.mockRestore();
    }
    expect(await protectedRows()).toEqual(before);
  });
});
