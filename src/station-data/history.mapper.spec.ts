import { describe, expect, it } from 'vitest';

import type { WeatherHistoryStation } from '../integrations/weather/contracts.js';
import { decodeCursor, encodeCursor } from './cursor.js';
import { decodeHistoryCursor, historyQueryFingerprint, mapHistoryPage } from './history.mapper.js';
import { parseSoilHistoryQuery } from './station-data.contracts.js';

const upstream = (records: readonly Record<string, unknown>[]) =>
  [
    {
      station: 'NODE01',
      history: { soil: records },
    },
  ] as unknown as readonly WeatherHistoryStation[];

describe('soil history query', () => {
  it('accepts exact raw and aggregate range limits', () => {
    expect(
      parseSoilHistoryQuery({ begin: '2026-09-01T00:00:00Z', end: '2026-09-08T00:00:00Z' }),
    ).toMatchObject({ interval: 'raw', order: 'asc', limit: 100 });
    expect(
      parseSoilHistoryQuery({
        begin: '2026-06-01T00:00:00Z',
        end: '2026-08-30T00:00:00Z',
        interval: '1d',
        aggregate: 'mean',
      }),
    ).toMatchObject({ interval: '1d', aggregate: 'mean' });
  });

  it.each([
    { begin: '2026-09-01T00:00:00Z', end: '2026-09-08T00:00:00.001Z' },
    {
      begin: '2026-06-01T00:00:00Z',
      end: '2026-08-30T00:00:00.001Z',
      interval: '1d',
      aggregate: 'mean',
    },
    { begin: '2026-09-02T00:00:00Z', end: '2026-09-01T00:00:00Z' },
    { begin: '2026-09-01T00:00:00+07:00', end: '2026-09-02T00:00:00Z' },
    { begin: '2026-09-01T00:00:00Z', end: '2026-09-02T00:00:00Z', fields: 'ph,ph' },
    { begin: '2026-09-01T00:00:00Z', end: '2026-09-02T00:00:00Z', extra: true },
  ])('rejects unsafe history query %#', (query) => {
    expect(() => parseSoilHistoryQuery(query)).toThrow(
      expect.objectContaining({ code: 'VALIDATION_ERROR', statusCode: 400 }),
    );
  });
});

describe('history mapper and cursor', () => {
  const query = parseSoilHistoryQuery({
    begin: '2026-09-01T00:00:00Z',
    end: '2026-09-02T00:00:00Z',
    fields: 'light,moisture',
    limit: 2,
  });
  const fingerprint = historyQueryFingerprint({ stationCode: 'NODE01', query });

  it('maps sparse records to independent series without carrying values forward', () => {
    const page = mapHistoryPage({
      stationId: 'station-1',
      stationCode: 'NODE01',
      fields: query.fields,
      order: 'asc',
      limit: 2,
      queryFingerprint: fingerprint,
      fetchedAt: new Date('2026-09-02T01:00:00Z'),
      upstream: upstream([
        { ts: 1, time: '2026-09-01T00:00:00Z', moisture: 40 },
        { ts: 2, time: '2026-09-01T00:01:00Z', light: 300, moisture: 41 },
      ]),
    });

    expect(page.series.find(({ field }) => field === 'light')?.points).toHaveLength(1);
    expect(page.series.find(({ field }) => field === 'moisture')?.points).toHaveLength(2);
    expect(
      page.series.flatMap(({ points }) => points).every(({ quality }) => quality === 'good'),
    ).toBe(true);
  });

  it('continues through identical boundary records without duplicating them', () => {
    const records = [
      { ts: 1, time: '2026-09-01T00:00:00Z', moisture: 40 },
      { ts: 1, time: '2026-09-01T00:00:00Z', moisture: 40 },
      { ts: 2, time: '2026-09-01T00:01:00Z', moisture: 41 },
    ];
    const first = mapHistoryPage({
      stationId: 'station-1',
      stationCode: 'NODE01',
      fields: ['moisture'],
      order: 'asc',
      limit: 1,
      queryFingerprint: fingerprint,
      fetchedAt: new Date(),
      upstream: upstream(records),
    });
    if (!first.nextCursor) throw new Error('Expected first continuation cursor');
    const cursor = decodeCursor(first.nextCursor, 'soil-history');
    const second = mapHistoryPage({
      stationId: 'station-1',
      stationCode: 'NODE01',
      fields: ['moisture'],
      order: 'asc',
      limit: 1,
      queryFingerprint: fingerprint,
      boundaryFingerprint: cursor.boundaryFingerprint,
      boundaryOccurrence: cursor.boundaryOccurrence,
      fetchedAt: new Date(),
      upstream: upstream(records),
    });
    expect(second.series[0]?.points).toHaveLength(1);
    if (!second.nextCursor) throw new Error('Expected second continuation cursor');
    expect(decodeCursor(second.nextCursor, 'soil-history').boundaryOccurrence).toBe(2);
  });

  it('binds cursors to the complete canonical query', () => {
    expect(
      historyQueryFingerprint({ stationCode: 'NODE01', query: { ...query, order: 'desc' } }),
    ).not.toBe(fingerprint);
    expect(() => decodeHistoryCursor('invalid', fingerprint)).toThrow();
    const mismatched = encodeCursor({
      v: 1,
      kind: 'soil-history',
      queryFingerprint: 'b'.repeat(64),
      boundaryTime: '2026-09-01T00:00:00Z',
      boundaryFingerprint: 'c'.repeat(64),
      boundaryOccurrence: 1,
    });
    expect(() => decodeHistoryCursor(mismatched, fingerprint)).toThrow(
      expect.objectContaining({ code: 'VALIDATION_ERROR' }),
    );
    expect(() =>
      mapHistoryPage({
        stationId: 'station-1',
        stationCode: 'NODE01',
        fields: ['moisture'],
        order: 'asc',
        limit: 1,
        queryFingerprint: fingerprint,
        boundaryFingerprint: 'c'.repeat(64),
        fetchedAt: new Date(),
        upstream: upstream([{ ts: 1, time: '2026-09-01T00:00:00Z', moisture: 40 }]),
      }),
    ).toThrow(expect.objectContaining({ code: 'VALIDATION_ERROR' }));
  });
});
