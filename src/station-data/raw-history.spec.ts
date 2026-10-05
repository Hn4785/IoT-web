import { describe, expect, it } from 'vitest';

import { parseWeatherHistoryResponse } from '../integrations/weather/contracts.js';
import { normalizeRawHistory } from './raw-history.js';

const begin = new Date('2026-10-01T00:00:00.000Z');
const end = new Date('2026-10-01T01:00:00.000Z');
const normalize = (records: unknown[]) =>
  normalizeRawHistory({
    upstream: parseWeatherHistoryResponse({
      success: true,
      data: [{ station: 'RAW01', history: { soil: records } }],
    }).data,
    stationCode: 'RAW01',
    fields: ['moisture', 'temperature'],
    begin,
    end,
  });
const row = (moisture: unknown, temperature?: unknown) => ({
  ts: begin.getTime(),
  time: begin.toISOString(),
  moisture,
  ...(temperature !== undefined ? { temperature } : {}),
});

describe('validated raw history import', () => {
  it('uses the last visited timestamp as a descending continuation boundary', () => {
    const timestamp = begin.getTime() + 1;
    const upstream = parseWeatherHistoryResponse({
      success: true,
      data: [{ station: 'RAW01', history: { soil: [{ ...row(41), ts: timestamp }, row(40)] } }],
    }).data;
    expect(
      normalizeRawHistory({
        upstream,
        stationCode: 'RAW01',
        fields: ['moisture'],
        begin,
        end,
        order: 'desc',
      }).lastTimestamp,
    ).toBe(begin.getTime());
  });
  it('collapses identical observations but counts raw records before deduplication', () => {
    expect(normalize([row(40, 25), row(40, 25)])).toEqual({
      readings: [
        { field: 'moisture', value: 40, observedAt: begin.toISOString() },
        { field: 'temperature', value: 25, observedAt: begin.toISOString() },
      ],
      completeFields: ['moisture', 'temperature'],
      rawCount: 2,
      lastTimestamp: begin.getTime(),
    });
  });
  it('does not pick a winner or claim coverage for conflicting equal-time values', () => {
    const result = normalize([row(40, 25), row(41, 25)]);
    expect(result.readings).toEqual([
      { field: 'temperature', value: 25, observedAt: begin.toISOString() },
    ]);
    expect(result.completeFields).toEqual(['temperature']);
  });
  it('distinguishes valid empty windows from absent/invalid fields', () => {
    expect(normalize([])).toMatchObject({
      readings: [],
      completeFields: ['moisture', 'temperature'],
      rawCount: 0,
    });
    expect(normalize([row('40')])).toMatchObject({ readings: [], completeFields: [], rawCount: 1 });
  });
  it('refuses provider records outside the requested window', () => {
    expect(() => normalize([{ ...row(40), ts: end.getTime() + 1 }])).toThrow();
  });
  it('rejects missing/duplicate stations and contradictory timestamp ordering', () => {
    const upstream = parseWeatherHistoryResponse({
      success: true,
      data: [{ station: 'RAW01', history: { soil: [] } }],
    }).data;
    for (const data of [[], [...upstream, ...upstream]]) {
      expect(() =>
        normalizeRawHistory({
          upstream: data,
          stationCode: 'RAW01',
          fields: ['moisture'],
          begin,
          end,
        }),
      ).toThrow();
    }
    expect(() => normalize([{ ...row(40), ts: begin.getTime() + 1 }, row(41)])).toThrow();
  });
});
