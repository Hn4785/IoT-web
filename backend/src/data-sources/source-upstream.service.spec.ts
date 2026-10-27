import { startUpstreamServer } from '../../test/helpers/upstream-server.js';
import { makeTestRuntimeConfig } from '../../test/helpers/runtime-config.js';
import { SourceUpstreamService } from './source-upstream.service.js';

const soilSample = {
  ts: 1_788_009_600_000,
  time: '2026-09-01T00:00:00.000Z',
  _fieldTs: { moisture: 1_788_009_600_000 },
  moisture: 42.5,
};

describe('SourceUpstreamService soil discovery', () => {
  it('returns only station codes with supported numeric soil data', async () => {
    const upstream = await startUpstreamServer([
      { status: 200, body: { success: true, data: ['CENTER', 'NODE01', 'NODE02'] } },
      {
        status: 200,
        body: {
          success: true,
          data: [
            {
              station: 'CENTER',
              latest: {
                weather: {
                  ts: soilSample.ts,
                  time: soilSample.time,
                  _fieldTs: {},
                  temperature: 31,
                },
              },
            },
            { station: 'NODE01', latest: { soil: soilSample } },
            {
              station: 'NODE02',
              latest: {
                soil: {
                  ts: soilSample.ts,
                  time: soilSample.time,
                  _fieldTs: {},
                  moisture: 'not-a-number',
                },
              },
            },
          ],
        },
      },
    ]);
    const service = new SourceUpstreamService(
      makeTestRuntimeConfig({ dataSourceAllowedOrigins: [new URL(upstream.baseUrl).origin] }),
    );

    try {
      await expect(
        service.discoverSoilStations(`${upstream.baseUrl}/api/v1`, 'test-source-key'),
      ).resolves.toEqual(['NODE01']);
      expect(upstream.requests.map(({ path }) => path)).toEqual([
        '/api/v1/stations',
        '/api/v1/data/latest?station=CENTER%2CNODE01%2CNODE02&type=soil',
      ]);
      expect(upstream.requests[1]?.headers['x-api-key']).toBe('test-source-key');
    } finally {
      await upstream.close();
    }
  });

  it('rejects a source when no eligible soil station remains', async () => {
    const upstream = await startUpstreamServer([
      { status: 200, body: { success: true, data: ['CENTER'] } },
      {
        status: 200,
        body: {
          success: true,
          data: [
            {
              station: 'CENTER',
              latest: {
                weather: {
                  ts: soilSample.ts,
                  time: soilSample.time,
                  _fieldTs: {},
                  temperature: 31,
                },
              },
            },
          ],
        },
      },
    ]);
    const service = new SourceUpstreamService(
      makeTestRuntimeConfig({ dataSourceAllowedOrigins: [new URL(upstream.baseUrl).origin] }),
    );

    try {
      await expect(
        service.discoverSoilStations(`${upstream.baseUrl}/api/v1`, 'test-source-key'),
      ).rejects.toMatchObject({
        code: 'NOT_SOIL_SOURCE',
        statusCode: 422,
        safeMessage: 'Connection does not provide soil station data',
      });
    } finally {
      await upstream.close();
    }
  });
});
