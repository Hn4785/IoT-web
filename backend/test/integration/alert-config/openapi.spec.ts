import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createApp } from '../../../src/app/create-app.js';
import { makeTestRuntimeConfig } from '../../helpers/runtime-config.js';

describe('Phase C OpenAPI alert-rule contract', () => {
  let app: Awaited<ReturnType<typeof createApp>>;

  beforeAll(async () => {
    app = await createApp(makeTestRuntimeConfig());
  });

  afterAll(async () => {
    await app.close();
  });

  it('publishes alert-rule paths, bearer security, and documented responses', async () => {
    const response = await app.inject({ method: 'GET', url: '/docs-json' });
    type OpenApiSchema = {
      additionalProperties?: boolean;
      items?: OpenApiSchema;
      properties?: Record<string, OpenApiSchema>;
    };
    type Operation = {
      security?: unknown;
      parameters?: Array<{
        name?: string;
        in?: string;
        schema?: { format?: string; type?: string };
      }>;
      requestBody?: {
        content?: {
          'application/json'?: {
            schema?: { additionalProperties?: boolean; properties?: Record<string, unknown> };
          };
        };
      };
      responses?: Record<
        string,
        {
          description?: string;
          content?: { 'application/json'?: { schema?: OpenApiSchema } };
        }
      >;
    };
    const document = response.json<{
      paths: Record<string, { get?: Operation; post?: Operation; patch?: Operation }>;
    }>();

    expect(response.statusCode).toBe(200);

    const stationRulesPath = document.paths['/api/v1/stations/{stationId}/alert-rules'];
    expect(stationRulesPath).toBeDefined();
    if (!stationRulesPath) throw new Error('Missing station alert-rule OpenAPI path');
    expect(stationRulesPath.get).toBeDefined();
    expect(stationRulesPath.post).toBeDefined();

    // Security check: bearer required
    expect(stationRulesPath.get?.security).toEqual([{ bearer: [] }]);
    expect(stationRulesPath.post?.security).toEqual([{ bearer: [] }]);

    // Parameter checks
    const stationIdParam = stationRulesPath.get?.parameters?.find((p) => p.name === 'stationId');
    expect(stationIdParam?.schema?.format).toBe('uuid');

    // POST Idempotency-Key header
    const postHeaders = stationRulesPath.post?.parameters?.find(
      (p) => p.name === 'Idempotency-Key',
    );
    expect(postHeaders).toBeDefined();

    // Documented responses for POST
    expect(stationRulesPath.post?.responses?.['201']).toBeDefined();
    expect(stationRulesPath.post?.responses?.['400']).toBeDefined();
    expect(stationRulesPath.post?.responses?.['401']).toBeDefined();
    expect(stationRulesPath.post?.responses?.['403']).toBeDefined();
    expect(stationRulesPath.post?.responses?.['404']).toBeDefined();
    expect(stationRulesPath.post?.responses?.['409']).toBeDefined();
    const createSchema = stationRulesPath.post?.requestBody?.content?.['application/json']?.schema;
    expect(createSchema?.additionalProperties).toBe(false);
    expect(createSchema?.properties?.field).toBeDefined();
    expect(createSchema?.properties?.unit).toBeDefined();
    expect(createSchema?.properties?.expectedMetadataRevision).toBeDefined();
    expect(createSchema?.properties?.condition).toBeDefined();
    expect(createSchema?.properties?.severity).toBeDefined();
    const createdRule =
      stationRulesPath.post?.responses?.['201']?.content?.['application/json']?.schema?.properties
        ?.data?.properties;
    expect(createdRule?.metadataRevision).toBeDefined();
    expect(createdRule?.evaluationStatus).toBeDefined();
    expect(createdRule?.revision).toBeDefined();

    const singleRulePath = document.paths['/api/v1/alert-rules/{ruleId}'];
    expect(singleRulePath).toBeDefined();
    if (!singleRulePath) throw new Error('Missing single alert-rule OpenAPI path');
    expect(singleRulePath.get).toBeDefined();
    expect(singleRulePath.patch).toBeDefined();

    expect(singleRulePath.get?.security).toEqual([{ bearer: [] }]);
    expect(singleRulePath.patch?.security).toEqual([{ bearer: [] }]);

    // Documented responses for PATCH
    expect(singleRulePath.patch?.responses?.['200']).toBeDefined();
    expect(singleRulePath.patch?.responses?.['400']).toBeDefined();
    expect(singleRulePath.patch?.responses?.['401']).toBeDefined();
    expect(singleRulePath.patch?.responses?.['403']).toBeDefined();
    expect(singleRulePath.patch?.responses?.['404']).toBeDefined();
    expect(singleRulePath.patch?.responses?.['409']).toBeDefined();
    const patchSchema = singleRulePath.patch?.requestBody?.content?.['application/json']?.schema;
    expect(patchSchema?.additionalProperties).toBe(false);
    expect(patchSchema?.properties?.expectedRevision).toBeDefined();

    expect(document.paths['/api/v1/alerts']?.get).toBeDefined();
    expect(document.paths['/api/v1/alerts/{alertId}']?.get).toBeDefined();
    expect(document.paths['/api/v1/alerts/{alertId}/acknowledgements']?.post).toBeDefined();
    expect(document.paths['/api/v1/alerts/{alertId}/resolutions']?.post).toBeDefined();

    const alerts = document.paths['/api/v1/alerts']?.get;
    expect(alerts?.security).toEqual([{ bearer: [] }]);
    expect(alerts?.parameters?.map((parameter) => parameter.name)).toEqual(
      expect.arrayContaining(['stationId', 'status', 'severity', 'limit', 'cursor']),
    );
    const listSchema = alerts?.responses?.['200']?.content?.['application/json']?.schema;
    expect(listSchema?.properties?.data?.properties?.nextCursor).toBeDefined();
    const alertProperties = listSchema?.properties?.data?.properties?.items?.items?.properties;
    expect(alertProperties?.station).toBeDefined();
    expect(alertProperties?.unit).toBeDefined();
    expect(alertProperties?.metadataRevision).toBeDefined();
    expect(alertProperties?.condition).toBeDefined();
    expect(alertProperties?.acknowledgedBy).toBeDefined();
    expect(alertProperties?.resolvedBy).toBeDefined();

    for (const route of [
      document.paths['/api/v1/alerts/{alertId}/acknowledgements']?.post,
      document.paths['/api/v1/alerts/{alertId}/resolutions']?.post,
    ]) {
      expect(route?.responses?.['201']).toBeDefined();
      expect(route?.responses?.['400']).toBeDefined();
      expect(route?.responses?.['401']).toBeDefined();
      expect(route?.responses?.['403']).toBeDefined();
      expect(route?.responses?.['404']).toBeDefined();
      expect(route?.responses?.['409']).toBeDefined();
      expect(route?.requestBody?.content?.['application/json']?.schema?.additionalProperties).toBe(
        false,
      );
    }

    const notifications = document.paths['/api/v1/notifications']?.get;
    const notification = document.paths['/api/v1/notifications/{notificationId}']?.patch;
    expect(notifications?.security).toEqual([{ bearer: [] }]);
    expect(notifications?.parameters?.map((parameter) => parameter.name)).toEqual(
      expect.arrayContaining(['isRead', 'limit', 'cursor']),
    );
    const notificationPage =
      notifications?.responses?.['200']?.content?.['application/json']?.schema?.properties?.data
        ?.properties;
    expect(notificationPage?.unreadCount).toBeDefined();
    expect(notificationPage?.nextCursor).toBeDefined();
    expect(notificationPage?.items?.items?.properties?.station).toBeDefined();
    expect(notification?.security).toEqual([{ bearer: [] }]);
    expect(notification?.requestBody?.content?.['application/json']?.schema).toMatchObject({
      additionalProperties: false,
      properties: { isRead: { type: 'boolean' } },
    });
    expect(notification?.responses?.['200']).toBeDefined();
    expect(notification?.responses?.['404']).toBeDefined();

    const capability = document.paths['/api/v1/device-configurations/capability']?.get;
    expect(capability?.security).toEqual([{ bearer: [] }]);
    const capabilityData =
      capability?.responses?.['200']?.content?.['application/json']?.schema?.properties?.data
        ?.properties;
    expect(capabilityData?.status).toBeDefined();
    expect(capabilityData?.reasonCode).toBeDefined();
  });
});
