import type { RuntimeConfig } from '../../config/runtime-config.js';
import { startUpstreamServer } from '../../../test/helpers/upstream-server.js';
import { parseLatestWeatherQuery, parseWeatherHistoryQuery } from './contracts.js';
import { WeatherClientService } from './weather-client.service.js';

const makeClient = (baseUrl: string, apiKey = 'server-only-key') => {
  const config: RuntimeConfig = {
    nodeEnv: 'test',
    port: 3000,
    logLevel: 'info',
    weatherApiBaseUrl: baseUrl,
    weatherApiKey: apiKey,
    weatherApiTimeoutMs: 1_000,
  };

  return new WeatherClientService(config);
};

describe('WeatherClientService', () => {
  it('uses the API key only for protected upstream endpoints', async () => {
    const upstream = await startUpstreamServer([
      {
        status: 200,
        body: {
          success: true,
          data: {
            service: 'weather-api',
            version: '1.0.0',
            status: 'healthy',
            environment: 'test',
            ts: 1_784_271_234_567,
            time: '2026-07-21T10:30:15.123Z',
          },
        },
      },
      { status: 200, body: { success: true, data: ['CENTER', 'NODE01'] } },
    ]);
    const client = makeClient(`${upstream.baseUrl}/api/v1`);

    try {
      const health = await client.getHealth();
      const stations = await client.listStations();

      expect(health.status).toBe('healthy');
      expect(stations).toEqual(['CENTER', 'NODE01']);
      expect(upstream.requests[0]?.headers['x-api-key']).toBeUndefined();
      expect(upstream.requests[1]?.headers['x-api-key']).toBe('server-only-key');
      expect(upstream.requests.map(({ path }) => path)).toEqual([
        '/api/v1/health',
        '/api/v1/stations',
      ]);
    } finally {
      await upstream.close();
    }
  });

  it('gets validated latest data with a literal encoded query', async () => {
    const upstream = await startUpstreamServer([
      {
        status: 200,
        body: {
          success: true,
          data: [
            {
              station: 'CENTER',
              latest: {
                soil: {
                  ts: 1_784_271_234_567,
                  time: '2026-07-21T10:30:15.123Z',
                  _fieldTs: {
                    moisture: 1_784_271_234_567,
                    ph: 1_784_271_234_500,
                  },
                  moisture: 42.5,
                  ph: 6.8,
                },
              },
            },
          ],
        },
      },
    ]);
    const client = makeClient(`${upstream.baseUrl}/api/v1`);
    const query = parseLatestWeatherQuery({
      station: ['CENTER', 'NODE01'],
      type: ['soil'],
      fields: ['moisture', 'ph'],
    });

    try {
      const latest = await client.getLatest(query);

      expect(latest[0]?.latest.soil?.moisture).toBe(42.5);
      expect(upstream.requests[0]?.path).toBe(
        '/api/v1/data/latest?station=CENTER%2CNODE01&type=soil&fields=moisture%2Cph',
      );
      expect(upstream.requests[0]?.headers['x-api-key']).toBe('server-only-key');
    } finally {
      await upstream.close();
    }
  });

  it('gets validated history data with defaults encoded explicitly', async () => {
    const upstream = await startUpstreamServer([
      {
        status: 200,
        body: {
          success: true,
          data: [
            {
              station: 'NODE01',
              history: {
                soil: [
                  {
                    ts: 1_784_012_400_000,
                    time: '2026-07-18T00:00:00.000Z',
                    moisture: 41.2,
                  },
                ],
              },
            },
          ],
        },
      },
    ]);
    const client = makeClient(`${upstream.baseUrl}/api/v1`);
    const query = parseWeatherHistoryQuery({
      station: ['NODE01'],
      begin: '2026-07-17T00:00:00Z',
      end: '2026-07-18T00:00:00Z',
      order: 'asc',
    });

    try {
      const history = await client.getHistory(query);

      expect(history[0]?.history.soil?.[0]?.moisture).toBe(41.2);
      expect(upstream.requests[0]?.path).toBe(
        '/api/v1/data/history?station=NODE01&begin=2026-07-17T00%3A00%3A00Z&end=2026-07-18T00%3A00%3A00Z&limit=100&order=asc&interval=raw&aggregate=mean',
      );
      expect(upstream.requests[0]?.headers['x-api-key']).toBe('server-only-key');
    } finally {
      await upstream.close();
    }
  });

  it('rejects a success-shaped payload sent with a non-success HTTP status', async () => {
    const upstream = await startUpstreamServer([
      { status: 500, body: { success: true, data: ['CENTER'] } },
    ]);
    const client = makeClient(`${upstream.baseUrl}/api/v1`);

    try {
      await expect(client.listStations()).rejects.toBeInstanceOf(Error);
    } finally {
      await upstream.close();
    }
  });

  it.each(['/NODE01', 'NODE01?redirect=true', 'https://evil.example'])(
    'rejects a station value that could alter the upstream URL: %s',
    (station) => {
      expect(() => parseLatestWeatherQuery({ station: [station] })).toThrow();
    },
  );
});
