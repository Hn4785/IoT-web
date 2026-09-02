import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createApp } from '../../../src/app/create-app.js';
import { makeTestRuntimeConfig } from '../../helpers/runtime-config.js';

describe('Phase A OpenAPI boundary', () => {
  let app: Awaited<ReturnType<typeof createApp>>;

  beforeAll(async () => {
    app = await createApp(makeTestRuntimeConfig());
  });

  afterAll(async () => {
    await app.close();
  });

  it('publishes bearer, refresh-cookie and API-key schemes without secret fields', async () => {
    const response = await app.inject({ method: 'GET', url: '/docs-json' });
    type Operation = {
      security?: unknown;
      parameters?: Array<{ name?: string; schema?: { format?: string } }>;
      requestBody?: {
        content?: { 'application/json'?: { schema?: { additionalProperties?: boolean } } };
      };
    };
    const document = response.json<{
      paths: Record<string, { get?: Operation; post?: Operation; put?: Operation }>;
      components?: { securitySchemes?: Record<string, unknown> };
    }>();

    expect(response.statusCode).toBe(200);
    expect(Object.keys(document.components?.securitySchemes ?? {}).sort()).toEqual([
      'apiKey',
      'bearer',
      'refreshCookie',
    ]);
    expect(document.paths['/api/v1/auth/me']?.get?.security).toEqual([{ bearer: [] }]);
    expect(document.paths['/api/v1/auth/refresh']?.post?.security).toEqual([{ refreshCookie: [] }]);
    expect(
      document.paths['/api/v1/auth/login']?.post?.requestBody?.content?.['application/json']?.schema
        ?.additionalProperties,
    ).toBe(false);
    expect(
      document.paths['/api/v1/developer/api-keys']?.post?.requestBody?.content?.['application/json']
        ?.schema?.additionalProperties,
    ).toBe(false);
    expect(
      document.paths['/api/v1/developer/api-keys/{apiKeyId}/rotate']?.post?.parameters?.[0]?.schema
        ?.format,
    ).toBe('uuid');
    expect(
      document.paths[
        '/api/v1/admin/users/{userId}/farm-memberships/{farmId}'
      ]?.put?.parameters?.map((parameter) => parameter.schema?.format),
    ).toEqual(['uuid', 'uuid']);
    const provisioningContract = JSON.stringify(document.paths['/api/v1/admin/users']?.post);
    expect(provisioningContract).toContain('"temporaryPassword"');
    expect(provisioningContract).toContain('"readOnly":true');
    expect(provisioningContract).not.toContain('"writeOnly":true');
    expect(response.body).not.toMatch(
      /passwordHash|tokenHash|keyHash|DATABASE_URL|JWT_SECRET|CREDENTIAL_PEPPER/,
    );
  });
});
