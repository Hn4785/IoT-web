import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import type { SchemaObject } from '@nestjs/swagger';
import { afterEach, describe, expect, it } from 'vitest';

import { createApp } from '../../../src/app/create-app.js';
import { makeTestRuntimeConfig } from '../../helpers/runtime-config.js';

type OpenApiSchemaView = SchemaObject & {
  properties?: Record<string, OpenApiSchemaView>;
  items?: OpenApiSchemaView;
};

type OpenApiRouteView = {
  security?: Record<string, unknown>[];
  parameters?: Array<{ name: string; in: string }>;
  responses?: Record<string, { content?: { 'application/json'?: { schema?: OpenApiSchemaView } } }>;
};

describe('Phase B OpenAPI contract', () => {
  let app: NestFastifyApplication | undefined;

  afterEach(async () => app?.close());

  it('documents scoped browser and client station-data routes without internal fields', async () => {
    app = await createApp(makeTestRuntimeConfig());
    const response = await app.inject({ method: 'GET', url: '/docs-json' });
    expect(response.statusCode).toBe(200);

    const document = response.json<{
      paths: Record<string, Record<string, OpenApiRouteView>>;
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

    const getSuccessSchema = (path: string): OpenApiSchemaView => {
      const schema =
        document.paths[path]?.get?.responses?.['200']?.content?.['application/json']?.schema;
      if (!schema) throw new Error(`Missing 200 schema for ${path}`);
      return schema;
    };

    const requireProp = (schema: OpenApiSchemaView, key: string): OpenApiSchemaView => {
      const prop = schema.properties?.[key];
      if (!prop) throw new Error(`Missing property ${key}`);
      return prop;
    };

    const requireItems = (schema: OpenApiSchemaView): OpenApiSchemaView => {
      const items = schema.items;
      if (!items) throw new Error('Missing items schema');
      return items;
    };

    const browserLatest = getSuccessSchema('/api/v1/stations/{stationId}/data/latest');
    const clientLatest = getSuccessSchema('/api/v1/client/data/latest');
    const browserHistory = getSuccessSchema('/api/v1/stations/{stationId}/data/history');
    const clientHistory = getSuccessSchema('/api/v1/client/data/history');

    expect(clientLatest).toEqual(browserLatest);
    expect(browserLatest.required).toEqual(['success', 'data']);

    const latestData = requireProp(browserLatest, 'data');
    expect(latestData.required).toEqual([
      'station',
      'measurement',
      'dataOrigin',
      'fields',
      'fetchedAt',
      'isFromCache',
      'isStale',
    ]);
    expect(requireProp(latestData, 'dataOrigin')).toEqual({
      type: 'string',
      enum: ['upstream', 'stored'],
    });
    const fieldItem = requireItems(requireProp(latestData, 'fields'));
    expect(fieldItem.properties?.quality?.enum).toEqual(['good', 'stale', 'unknown']);

    expect(clientHistory).toEqual(browserHistory);
    expect(browserHistory.required).toEqual(['success', 'data']);

    const historyData = requireProp(browserHistory, 'data');
    expect(historyData.required).toEqual([
      'stationId',
      'measurement',
      'dataOrigin',
      'series',
      'page',
      'fetchedAt',
      'isFromCache',
      'isStale',
    ]);
    expect(requireProp(historyData, 'dataOrigin')).toEqual({
      type: 'string',
      enum: ['upstream', 'stored'],
    });
    const coverage = requireProp(historyData, 'coverage');
    expect(coverage.properties?.status?.enum).toEqual(['complete', 'partial', 'unknown']);
    const rangeItem = requireItems(
      requireProp(requireItems(requireProp(coverage, 'fields')), 'ranges'),
    );
    expect(rangeItem.properties?.begin?.format).toBe('date-time');
    expect(rangeItem.properties?.end?.format).toBe('date-time');

    const seriesItem = requireItems(requireProp(historyData, 'series'));
    for (const key of ['unit', 'sensorId', 'depthCm'] as const) {
      expect(fieldItem.properties?.[key]?.nullable).toBe(true);
      expect(seriesItem.properties?.[key]?.nullable).toBe(true);
    }
    const pointItem = requireItems(requireProp(seriesItem, 'points'));
    expect(pointItem.properties?.observedAt?.format).toBe('date-time');
    expect(pointItem.properties?.quality?.enum).toEqual(['good', 'stale', 'unknown']);

    expect(requireProp(historyData, 'page').properties?.nextCursor?.nullable).toBe(true);

    for (const path of [
      '/api/v1/stations/{stationId}/data/history',
      '/api/v1/client/data/history',
    ]) {
      expect(document.paths[path]?.get?.parameters).toContainEqual(
        expect.objectContaining({ name: 'cursor', in: 'query' }),
      );
    }
  });
});
