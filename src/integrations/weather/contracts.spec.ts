import { describe, expect, it } from 'vitest';

import {
  parseLatestWeatherQuery,
  parseWeatherFailureResponse,
  parseWeatherHealthResponse,
  parseWeatherHistoryQuery,
  parseWeatherHistoryResponse,
  parseWeatherLatestResponse,
  parseWeatherStationsResponse,
} from './contracts.js';

describe('Weather API contracts', () => {
  describe('parseLatestWeatherQuery', () => {
    it('accepts and normalizes a latest soil query', () => {
      expect(
        parseLatestWeatherQuery({
          station: ['CENTER', 'NODE01'],
          type: ['soil'],
          fields: ['moisture', 'ph'],
        }),
      ).toEqual({
        station: ['CENTER', 'NODE01'],
        type: ['soil'],
        fields: ['moisture', 'ph'],
      });
    });

    it.each([
      [{ type: ['unknown'] }],
      [{ station: [''] }],
      [{ fields: ['temperature', '<script>'] }],
      [{ station: ['NODE01', 'NODE01'] }],
    ])('rejects an unsafe latest query %#', (input) => {
      expect(() => parseLatestWeatherQuery(input)).toThrow();
    });
  });

  describe('parseWeatherHistoryQuery', () => {
    it.each([1, 5000])('accepts the inclusive limit boundary %i', (limit) => {
      expect(parseWeatherHistoryQuery({ limit })).toEqual({
        limit,
        order: 'desc',
        interval: 'raw',
      });
    });

    it('requires aggregate for non-raw intervals and rejects it for raw', () => {
      expect(parseWeatherHistoryQuery({ interval: '5m', aggregate: 'mean' })).toMatchObject({
        interval: '5m',
        aggregate: 'mean',
      });
      expect(() => parseWeatherHistoryQuery({ interval: '5m' })).toThrow();
      expect(() => parseWeatherHistoryQuery({ interval: 'raw', aggregate: 'mean' })).toThrow();
    });

    it('rejects history when begin is after end', () => {
      expect(() =>
        parseWeatherHistoryQuery({
          begin: '2026-08-31T00:00:00Z',
          end: '2026-08-30T00:00:00Z',
          limit: 100,
          order: 'asc',
          interval: 'raw',
        }),
      ).toThrow();
    });

    it.each([
      [{ limit: 0 }],
      [{ limit: 5001 }],
      [{ begin: '2026-08-31T07:00:00+07:00' }],
      [{ interval: '2m' }],
      [{ aggregate: 'median' }],
      [{ unexpected: true }],
    ])('rejects an unsafe history query %#', (input) => {
      expect(() => parseWeatherHistoryQuery(input)).toThrow();
    });
  });

  describe('Weather API response envelopes', () => {
    it('accepts a complete health envelope', () => {
      expect(
        parseWeatherHealthResponse({
          success: true,
          data: {
            service: 'weather-api',
            version: '1.0.0',
            status: 'healthy',
            environment: 'production',
            ts: 1788163200000,
            time: '2026-08-31T00:00:00Z',
          },
        }),
      ).toEqual({
        success: true,
        data: {
          service: 'weather-api',
          version: '1.0.0',
          status: 'healthy',
          environment: 'production',
          ts: 1788163200000,
          time: '2026-08-31T00:00:00Z',
        },
      });
    });

    it('accepts a station list envelope', () => {
      expect(parseWeatherStationsResponse({ success: true, data: ['CENTER', 'NODE01'] })).toEqual({
        success: true,
        data: ['CENTER', 'NODE01'],
      });
    });

    it('preserves primitive dynamic fields in a valid latest envelope', () => {
      const input = {
        success: true,
        data: [
          {
            station: 'NODE01',
            latest: {
              soil: {
                ts: 1784882119021,
                time: '2026-07-24T08:35:19Z',
                _fieldTs: { moisture: 1784882119021 },
                moisture: 43,
                connected: true,
                note: null,
              },
            },
          },
        ],
      };

      expect(parseWeatherLatestResponse(input)).toEqual(input);
    });

    it('preserves a valid sparse raw history record', () => {
      const parsed = parseWeatherHistoryResponse({
        success: true,
        data: [
          {
            station: 'NODE01',
            history: {
              soil: [{ ts: 1784276746000, time: '2026-07-17T08:25:46Z', light: 28.958 }],
            },
          },
        ],
      });

      expect(parsed.data[0]?.history.soil?.[0]).toEqual({
        ts: 1784276746000,
        time: '2026-07-17T08:25:46Z',
        light: 28.958,
      });
    });

    it.each([
      [
        'a string timestamp',
        {
          success: true,
          data: [
            {
              station: 'NODE01',
              latest: {
                soil: {
                  ts: '1784882119021',
                  time: '2026-07-24T08:35:19Z',
                  _fieldTs: {},
                  moisture: 43,
                },
              },
            },
          ],
        },
      ],
      [
        'an unknown measurement type',
        {
          success: true,
          data: [
            {
              station: 'NODE01',
              latest: {
                air: {
                  ts: 1784882119021,
                  time: '2026-07-24T08:35:19Z',
                  _fieldTs: {},
                },
              },
            },
          ],
        },
      ],
      [
        'a nested dynamic value',
        {
          success: true,
          data: [
            {
              station: 'NODE01',
              latest: {
                soil: {
                  ts: 1784882119021,
                  time: '2026-07-24T08:35:19Z',
                  _fieldTs: {},
                  metadata: { injected: true },
                },
              },
            },
          ],
        },
      ],
    ])('rejects a latest envelope containing %s', (_case, input) => {
      expect(() => parseWeatherLatestResponse(input)).toThrow();
    });

    it('accepts a failure envelope', () => {
      const failure = { success: false, message: 'Upstream unavailable' } as const;

      expect(parseWeatherFailureResponse(failure)).toEqual(failure);
    });

    it('rejects a failure envelope in a successful parser', () => {
      const failure = { success: false, message: 'Upstream unavailable' } as const;

      expect(() => parseWeatherLatestResponse(failure)).toThrow();
    });
  });
});
