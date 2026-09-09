import { describe, expect, it } from 'vitest';

import type { WeatherLatestStation } from '../integrations/weather/contracts.js';
import { mapLatestSoil, toLatestSoilDto } from './soil.mapper.js';
import type { AuthorizedStation } from './station.repository.js';

const station: AuthorizedStation = {
  id: '11111111-1111-4111-8111-111111111111',
  farmId: '22222222-2222-4222-8222-222222222222',
  plotId: '33333333-3333-4333-8333-333333333333',
  name: 'Station NODE01',
  code: 'NODE01',
  upstreamCode: 'NODE01',
};

const upstream = (soil: Record<string, unknown>): readonly WeatherLatestStation[] =>
  [{ station: 'NODE01', latest: { soil } }] as unknown as readonly WeatherLatestStation[];

describe('latest soil mapper', () => {
  it('preserves allowlisted numeric values and uses each field timestamp', () => {
    const mapped = mapLatestSoil({
      station,
      fields: ['moisture', 'light'],
      fetchedAt: new Date('2026-07-31T03:40:00.000Z'),
      upstream: upstream({
        ts: 1785469178997,
        time: '2026-07-31T03:39:38.997Z',
        _fieldTs: { moisture: 1784276866000, light: 1784882119021 },
        moisture: 43,
        light: 28.958,
        hostile: 999,
      }),
    });

    expect(mapped.fields).toEqual([
      { field: 'moisture', value: 43, observedAt: new Date(1784276866000).toISOString() },
      { field: 'light', value: 28.958, observedAt: new Date(1784882119021).toISOString() },
    ]);
    expect(mapped).not.toHaveProperty('hostile');
  });

  it('omits invalid fields but fails safely when no requested value is usable', () => {
    const partial = mapLatestSoil({
      station,
      fields: ['moisture', 'ph'],
      fetchedAt: new Date(),
      upstream: upstream({
        ts: 1,
        time: '2026-01-01T00:00:00Z',
        _fieldTs: { moisture: 1784276866000, ph: 1784276866000 },
        moisture: 43,
        ph: '6.5',
      }),
    });
    expect(partial.fields.map(({ field }) => field)).toEqual(['moisture']);

    expect(() =>
      mapLatestSoil({
        station,
        fields: ['ph'],
        fetchedAt: new Date(),
        upstream: upstream({
          ts: 1,
          time: '2026-01-01T00:00:00Z',
          _fieldTs: { ph: 1784276866000 },
          ph: Number.NaN,
        }),
      }),
    ).toThrow(expect.objectContaining({ code: 'UPSTREAM_INVALID_RESPONSE', statusCode: 502 }));
  });

  it('rejects missing, wrong, or duplicate station results', () => {
    const input = { station, fields: ['moisture'] as const, fetchedAt: new Date() };
    expect(() => mapLatestSoil({ ...input, upstream: [] })).toThrow(
      expect.objectContaining({ code: 'UPSTREAM_INVALID_RESPONSE' }),
    );
    expect(() => mapLatestSoil({ ...input, upstream: upstream({}) })).toThrow(
      expect.objectContaining({ code: 'UPSTREAM_INVALID_RESPONSE' }),
    );
    const duplicate = [...upstream({}), ...upstream({})];
    expect(() => mapLatestSoil({ ...input, upstream: duplicate })).toThrow(
      expect.objectContaining({ code: 'UPSTREAM_INVALID_RESPONSE' }),
    );
  });

  it('projects freshness and unconfirmed metadata without inventing units', () => {
    const mapped = mapLatestSoil({
      station,
      fields: ['moisture', 'light'],
      fetchedAt: new Date('2026-07-31T03:40:00.000Z'),
      upstream: upstream({
        ts: 1,
        time: '2026-07-31T03:39:38.997Z',
        _fieldTs: { moisture: 1785469178997, light: 1784276866000 },
        moisture: 43,
        light: 28.958,
      }),
    });
    const dto = toLatestSoilDto(mapped, new Date(1785469200000), 900_000, {
      isFromCache: false,
      isStale: false,
    });

    expect(dto.measurement).toBe('soil');
    expect(dto.fields[0]).toMatchObject({
      quality: 'good',
      unit: null,
      sensorId: null,
      depthCm: null,
    });
    expect(dto.fields[1]?.quality).toBe('stale');
    expect(dto.isStale).toBe(true);
  });
});
