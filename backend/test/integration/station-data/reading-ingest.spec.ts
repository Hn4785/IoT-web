import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { PrismaService } from '../../../src/database/prisma.service.js';
import { SoilReadingRepository } from '../../../src/station-data/soil-reading.repository.js';
import type { AuthorizedStation } from '../../../src/station-data/station.repository.js';
import { createTestPrismaClient, prepareTestDatabase } from '../../helpers/database.js';

describe('normalized durable ingest', () => {
  const prisma = createTestPrismaClient();
  const repository = new SoilReadingRepository(prisma as PrismaService);
  let station: AuthorizedStation;
  const sampleTime = '2026-10-04T00:00:00.000Z';
  const ingest = (value: number, fetchedAt: string, observedAt = sampleTime) =>
    repository.ingestLatest(station, {
      station,
      fetchedAt,
      fields: [{ field: 'moisture', value, observedAt }],
    });

  beforeAll(async () => {
    await prepareTestDatabase();
    const farm = await prisma.farm.create({ data: { name: 'Ingest test' } });
    const plot = await prisma.plot.create({ data: { farmId: farm.id, name: 'Plot' } });
    const owner = await prisma.user.create({
      data: {
        email: 'storage-owner@example.test',
        displayName: 'Owner',
        passwordHash: 'test-only',
        role: 'ADMIN',
      },
    });
    const source = await prisma.dataSource.create({
      data: {
        ownerUserId: owner.id,
        name: 'Storage source',
        baseUrl: 'https://example.invalid',
        keyCiphertext: 'fixture',
        keyNonce: 'fixture',
        keyAuthTag: 'fixture',
        keyPreview: 'test',
        connectionStatus: 'CONNECTED',
        lastCheckedAt: new Date(),
      },
    });
    const row = await prisma.station.create({
      data: { plotId: plot.id, name: 'Node', upstreamCode: 'INGEST01', dataSourceId: source.id },
    });
    station = { ...row, farmId: farm.id, code: row.upstreamCode };
  });
  afterAll(() => prisma.$disconnect());

  it('deduplicates repeated observations and serializes corrections by fetch generation', async () => {
    await ingest(43.123456789, '2026-10-04T00:01:00.000Z');
    await ingest(43.123456789, '2026-10-04T00:01:00.000Z');
    await Promise.all([
      ingest(44, '2026-10-04T00:03:00.000Z'),
      ingest(42, '2026-10-04T00:02:00.000Z'),
    ]);
    const rows = await prisma.soilReading.findMany({ where: { stationId: station.id } });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ value: 44, fetchedAt: new Date('2026-10-04T00:03:00.000Z') });
    expect((await prisma.soilLatestReading.findFirst())?.value).toBe(44);
  });

  it('does not roll snapshots backwards with an older observation fetched later', async () => {
    await ingest(10, '2026-10-04T00:04:00.000Z', '2026-10-03T00:00:00.000Z');
    expect((await prisma.soilLatestReading.findFirst())?.value).toBe(44);
    expect(await prisma.soilReading.count()).toBe(2);
  });

  it('preserves original capture time and revision when identical latest/history is fetched later', async () => {
    const field = { field: 'temperature' as const, value: 25, observedAt: sampleTime };
    const original = '2026-10-04T00:01:00.000Z';
    await repository.ingestLatest(station, { station, fetchedAt: original, fields: [field] });
    await repository.ingestLatest(station, {
      station,
      fetchedAt: '2026-10-04T00:06:00.000Z',
      fields: [field],
    });
    await repository.ingestHistory(
      station,
      { readings: [field], completeFields: [], rawCount: 1, lastTimestamp: Date.parse(sampleTime) },
      new Date('2026-10-04T00:07:00.000Z'),
    );
    const expected = {
      value: 25,
      fetchedAt: new Date(original),
      lastFetchedAt: new Date('2026-10-04T00:07:00.000Z'),
      revision: 1,
      origin: 'latest',
    };
    expect(
      await prisma.soilReading.findFirst({
        where: { stationId: station.id, field: 'temperature' },
      }),
    ).toMatchObject(expected);
    expect(
      await prisma.soilLatestReading.findFirst({
        where: { stationId: station.id, field: 'temperature' },
      }),
    ).toMatchObject(expected);
    await repository.ingestLatest(station, {
      station,
      fetchedAt: '2026-10-04T00:05:00.000Z',
      fields: [{ ...field, value: 24 }],
    });
    await repository.ingestHistory(
      station,
      {
        readings: [{ ...field, value: 23 }],
        completeFields: [],
        rawCount: 1,
        lastTimestamp: Date.parse(sampleTime),
      },
      new Date('2026-10-04T00:06:30.000Z'),
    );
    expect(
      await prisma.soilReading.findFirst({
        where: { stationId: station.id, field: 'temperature' },
      }),
    ).toMatchObject(expected);
    expect(
      await prisma.soilLatestReading.findFirst({
        where: { stationId: station.id, field: 'temperature' },
      }),
    ).toMatchObject(expected);
    await repository.ingestHistory(
      station,
      {
        readings: [{ ...field, value: 26 }],
        completeFields: [],
        rawCount: 1,
        lastTimestamp: Date.parse(sampleTime),
      },
      new Date('2026-10-04T00:08:00.000Z'),
    );
    expect(
      await prisma.soilReading.findFirst({
        where: { stationId: station.id, field: 'temperature' },
      }),
    ).toMatchObject({
      value: 26,
      revision: 2,
      origin: 'rawHistory',
      fetchedAt: new Date('2026-10-04T00:08:00.000Z'),
      lastFetchedAt: new Date('2026-10-04T00:08:00.000Z'),
    });
    await repository.ingestLatest(station, {
      station,
      fetchedAt: '2026-10-04T00:10:00.000Z',
      fields: [{ ...field, value: 26 }],
    });
    await repository.ingestHistory(
      station,
      {
        readings: [{ ...field, value: 22 }],
        completeFields: [],
        rawCount: 1,
        lastTimestamp: Date.parse(sampleTime),
      },
      new Date('2026-10-04T00:09:00.000Z'),
    );
    const confirmed = await Promise.all([
      prisma.soilReading.findFirst({ where: { stationId: station.id, field: 'temperature' } }),
      prisma.soilLatestReading.findFirst({
        where: { stationId: station.id, field: 'temperature' },
      }),
    ]);
    for (const row of confirmed) {
      expect(row).toMatchObject({
        value: 26,
        revision: 2,
        origin: 'rawHistory',
        fetchedAt: new Date('2026-10-04T00:08:00.000Z'),
        lastFetchedAt: new Date('2026-10-04T00:10:00.000Z'),
      });
    }
  });
  it('starts a new observation fence even when its value is unchanged', async () => {
    const first = { field: 'light' as const, value: 19, observedAt: sampleTime };
    const next = { ...first, observedAt: '2026-10-04T00:00:01.000Z' };
    await repository.ingestLatest(station, {
      station,
      fetchedAt: '2026-10-04T00:12:00.000Z',
      fields: [first],
    });
    await repository.ingestLatest(station, {
      station,
      fetchedAt: '2026-10-04T00:11:00.000Z',
      fields: [next],
    });
    await repository.ingestLatest(station, {
      station,
      fetchedAt: '2026-10-04T00:20:00.000Z',
      fields: [{ ...first, value: 22 }],
    });
    expect(await prisma.soilLatestReading.findFirst({ where: { field: 'light' } })).toMatchObject({
      value: 19,
      observedAt: new Date(next.observedAt),
      fetchedAt: new Date('2026-10-04T00:11:00.000Z'),
      lastFetchedAt: new Date('2026-10-04T00:11:00.000Z'),
      revision: 1,
    });
  });
  it('fences late responses when their source has been removed', async () => {
    await prisma.dataSource.update({
      where: { id: station.dataSourceId },
      data: {
        removedAt: new Date(),
        keyCiphertext: null,
        keyNonce: null,
        keyAuthTag: null,
        keyPreview: null,
      },
    });
    await expect(ingest(55, '2026-10-04T00:05:00.000Z')).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
    expect(
      (await prisma.soilLatestReading.findFirst({ where: { field: 'moisture' } }))?.value,
    ).toBe(44);
  });
});
