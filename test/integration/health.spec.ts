import { afterEach, describe, expect, it } from 'vitest';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';

import { createApp } from '../../src/app/create-app.js';
import type { HealthResponse } from '../../src/health/health.controller.js';
import { makeTestRuntimeConfig } from '../helpers/runtime-config.js';

describe('GET /api/v1/health', () => {
  let app: NestFastifyApplication | undefined;

  afterEach(async () => {
    await app?.close();
  });

  it('returns the stable liveness envelope without secret values', async () => {
    app = await createApp(
      makeTestRuntimeConfig({
        weatherApiKey: 'must-not-appear',
      }),
    );

    const response = await app.inject({ method: 'GET', url: '/api/v1/health' });

    const body = response.json<HealthResponse>();

    expect(response.statusCode).toBe(200);
    expect(body).toMatchObject({
      success: true,
      data: {
        service: 'iot-api',
        version: '0.1.0',
        status: 'healthy',
        environment: 'test',
      },
    });
    expect(response.body).not.toContain('must-not-appear');
    expect(Number.isNaN(Date.parse(body.data.time))).toBe(false);
  });
});
