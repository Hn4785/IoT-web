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
    type Operation = {
      security?: unknown;
      parameters?: Array<{ name?: string; in?: string; schema?: { format?: string; type?: string } }>;
      requestBody?: {
        content?: { 'application/json'?: { schema?: { additionalProperties?: boolean; properties?: Record<string, unknown> } } };
      };
      responses?: Record<string, { description?: string }>;
    };
    const document = response.json<{
      paths: Record<string, { get?: Operation; post?: Operation; patch?: Operation }>;
    }>();

    expect(response.statusCode).toBe(200);

    const stationRulesPath = document.paths['/api/v1/stations/{stationId}/alert-rules'];
    expect(stationRulesPath).toBeDefined();
    expect(stationRulesPath.get).toBeDefined();
    expect(stationRulesPath.post).toBeDefined();

    // Security check: bearer required
    expect(stationRulesPath.get?.security).toEqual([{ bearer: [] }]);
    expect(stationRulesPath.post?.security).toEqual([{ bearer: [] }]);

    // Parameter checks
    const stationIdParam = stationRulesPath.get?.parameters?.find((p) => p.name === 'stationId');
    expect(stationIdParam?.schema?.format).toBe('uuid');

    // POST Idempotency-Key header
    const postHeaders = stationRulesPath.post?.parameters?.find((p) => p.name === 'Idempotency-Key');
    expect(postHeaders).toBeDefined();

    // Documented responses for POST
    expect(stationRulesPath.post?.responses?.['201']).toBeDefined();
    expect(stationRulesPath.post?.responses?.['400']).toBeDefined();
    expect(stationRulesPath.post?.responses?.['401']).toBeDefined();
    expect(stationRulesPath.post?.responses?.['403']).toBeDefined();
    expect(stationRulesPath.post?.responses?.['404']).toBeDefined();
    expect(stationRulesPath.post?.responses?.['409']).toBeDefined();

    const singleRulePath = document.paths['/api/v1/alert-rules/{ruleId}'];
    expect(singleRulePath).toBeDefined();
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
  });
});
