import { startUpstreamServer } from '../../../test/helpers/upstream-server.js';
import { makeTestRuntimeConfig } from '../../../test/helpers/runtime-config.js';
import { parseLatestWeatherQuery, parseWeatherHistoryQuery } from './contracts.js';
import { WeatherClientService } from './weather-client.service.js';

const makeClient = (baseUrl: string, apiKey = 'server-only-key', timeoutMs = 1_000) => {
  const config = makeTestRuntimeConfig({
    weatherApiBaseUrl: baseUrl,
    weatherApiKey: apiKey,
    weatherApiTimeoutMs: timeoutMs,
  });

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

  it.each([
    [401, 'UPSTREAM_UNAVAILABLE', 502, 'Weather service is unavailable'],
    [403, 'UPSTREAM_UNAVAILABLE', 502, 'Weather service is unavailable'],
    [429, 'RATE_LIMITED', 503, 'Weather service rate limit exceeded'],
    [500, 'UPSTREAM_UNAVAILABLE', 502, 'Weather service is unavailable'],
  ] as const)(
    'maps upstream HTTP %i to %s without exposing its failure body',
    async (upstreamStatus, code, statusCode, safeMessage) => {
      const upstreamBody = {
        success: false,
        message: 'raw upstream failure detail must stay private',
      };
      const upstream = await startUpstreamServer([{ status: upstreamStatus, body: upstreamBody }]);
      const client = makeClient(`${upstream.baseUrl}/api/v1`);

      try {
        let thrown: unknown;
        try {
          await client.listStations();
        } catch (error) {
          thrown = error;
        }

        expect(thrown).toMatchObject({ code, statusCode, safeMessage });
        expect(JSON.stringify(thrown)).not.toContain(upstreamBody.message);
      } finally {
        await upstream.close();
      }
    },
  );

  it('maps an upstream timeout without exposing the API key', async () => {
    const upstream = await startUpstreamServer([
      { status: 200, delayMs: 250, body: { success: true, data: [] } },
    ]);
    const apiKey = 'never-leak-this-key';
    const client = makeClient(`${upstream.baseUrl}/api/v1`, apiKey, 25);

    try {
      let thrown: unknown;
      try {
        await client.listStations();
      } catch (error) {
        thrown = error;
      }

      expect(thrown).toMatchObject({
        code: 'UPSTREAM_TIMEOUT',
        statusCode: 504,
        safeMessage: 'Weather service timed out',
      });
      expect(JSON.stringify(thrown)).not.toContain(apiKey);
    } finally {
      await upstream.close();
    }
  });

  it('rejects an upstream redirect as an unavailable dependency', async () => {
    const upstream = await startUpstreamServer([
      {
        status: 302,
        headers: { location: 'https://redirect.example/stations' },
        body: { success: false, error: { message: 'follow this redirect' } },
      },
    ]);
    const client = makeClient(`${upstream.baseUrl}/api/v1`);

    try {
      await expect(client.listStations()).rejects.toMatchObject({
        code: 'UPSTREAM_UNAVAILABLE',
        statusCode: 502,
        safeMessage: 'Weather service is unavailable',
      });
    } finally {
      await upstream.close();
    }
  });

  it('maps malformed upstream JSON without exposing credentials or the raw body', async () => {
    const rawBody = '{"secret":"raw-upstream-secret"';
    const apiKey = 'never-leak-this-key';
    const upstream = await startUpstreamServer([{ status: 200, rawBody }]);
    const client = makeClient(`${upstream.baseUrl}/api/v1`, apiKey);

    try {
      let thrown: unknown;
      try {
        await client.listStations();
      } catch (error) {
        thrown = error;
      }

      expect(thrown).toMatchObject({
        code: 'UPSTREAM_UNAVAILABLE',
        statusCode: 502,
        safeMessage: 'Weather service is unavailable',
      });
      const serialized = JSON.stringify(thrown);
      expect(serialized).not.toContain(apiKey);
      expect(serialized).not.toContain(rawBody);
    } finally {
      await upstream.close();
    }
  });

  it('maps an invalid stations schema without exposing the upstream body', async () => {
    const body = { success: true, data: 7 };
    const upstream = await startUpstreamServer([{ status: 200, body }]);
    const client = makeClient(`${upstream.baseUrl}/api/v1`);

    try {
      let thrown: unknown;
      try {
        await client.listStations();
      } catch (error) {
        thrown = error;
      }

      expect(thrown).toMatchObject({
        code: 'UPSTREAM_UNAVAILABLE',
        statusCode: 502,
        safeMessage: 'Weather service is unavailable',
      });
      expect(JSON.stringify(thrown)).not.toContain(JSON.stringify(body));
    } finally {
      await upstream.close();
    }
  });

  it('maps latest data missing required timestamps as unavailable', async () => {
    const body = {
      success: true,
      data: [
        {
          station: 'CENTER',
          latest: { soil: { _fieldTs: {}, moisture: 42.5 } },
        },
      ],
    };
    const upstream = await startUpstreamServer([{ status: 200, body }]);
    const client = makeClient(`${upstream.baseUrl}/api/v1`);
    const query = parseLatestWeatherQuery({ station: ['CENTER'] });

    try {
      await expect(client.getLatest(query)).rejects.toMatchObject({
        code: 'UPSTREAM_UNAVAILABLE',
        statusCode: 502,
        safeMessage: 'Weather service is unavailable',
      });
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
