import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { afterEach, describe, expect, it } from 'vitest';

import { createApp } from '../../../src/app/create-app.js';
import { makeTestRuntimeConfig } from '../../helpers/runtime-config.js';

describe('Phase B OpenAPI contract', () => {
  let app: NestFastifyApplication | undefined;

  afterEach(async () => app?.close());

  it('documents scoped browser and client station-data routes without internal fields', async () => {
    app = await createApp(makeTestRuntimeConfig());
    const response = await app.inject({ method: 'GET', url: '/docs-json' });
    expect(response.statusCode).toBe(200);

    const document = response.json<{
      paths: Record<string, Record<string, { security?: Record<string, unknown>[] }>>;
    }>();
    const browserPaths = [
      '/api/v1/farms',
      '/api/v1/farms/{farmId}/plots',
      '/api/v1/plots/{plotId}/stations',
      '/api/v1/stations/{stationId}',
      '/api/v1/stations/{stationId}/data/latest',
      '/api/v1/stations/{stationId}/data/history',
    ];
    const clientPaths = [
      '/api/v1/client/stations',
      '/api/v1/client/data/latest',
      '/api/v1/client/data/history',
    ];

    for (const path of browserPaths) {
      expect(document.paths[path]?.get?.security).toContainEqual({ bearer: [] });
    }
    for (const path of clientPaths) {
      expect(document.paths[path]?.get?.security).toContainEqual({ apiKey: [] });
    }

    const serialized = JSON.stringify(
      Object.fromEntries(
        [...browserPaths, ...clientPaths].map((path) => [path, document.paths[path]]),
      ),
    );
    expect(serialized).not.toMatch(/upstreamCode|passwordHash|tokenHash|keyHash|WEATHER_API_KEY/);
    expect(serialized).toContain('nullable');
    expect(serialized).toContain('isFromCache');
    expect(serialized).toContain('isStale');
  });
});
