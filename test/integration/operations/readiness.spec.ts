import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createApp } from '../../../src/app/create-app.js';
import { PrismaService } from '../../../src/database/prisma.service.js';
import { prepareTestDatabase } from '../../helpers/database.js';
import { makeTestRuntimeConfig } from '../../helpers/runtime-config.js';

describe('operations readiness', () => {
  let app: NestFastifyApplication | undefined;

  function currentApp(): NestFastifyApplication {
    if (!app) throw new Error('Test application is not initialized');
    return app;
  }

  beforeEach(async () => {
    await prepareTestDatabase();
    app = await createApp(makeTestRuntimeConfig());
  });

  afterEach(async () => {
    await app?.close();
    vi.restoreAllMocks();
  });

  it('reports database readiness without exposing connection details', async () => {
    const response = await currentApp().inject({ method: 'GET', url: '/api/v1/readiness' });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      success: true,
      data: { status: 'ready', dependencies: { database: { status: 'ready' } } },
    });
    expect(response.body).not.toContain('postgresql://');
  });

  it('keeps liveness independent and maps a database probe failure to a safe 503', async () => {
    const prisma = currentApp().get(PrismaService);
    const probe = vi
      .spyOn(prisma, '$queryRaw')
      .mockRejectedValue(new Error('postgresql://operator:secret@private-db/internal'));

    const live = await currentApp().inject({ method: 'GET', url: '/api/v1/health' });
    expect(live.statusCode).toBe(200);
    expect(probe).not.toHaveBeenCalled();

    const ready = await currentApp().inject({ method: 'GET', url: '/api/v1/readiness' });
    expect(ready.statusCode).toBe(503);
    expect(ready.json()).toMatchObject({
      success: false,
      error: { code: 'DATABASE_UNAVAILABLE', message: 'Database is temporarily unavailable' },
    });
    expect(ready.body).not.toContain('secret');
    expect(ready.body).not.toContain('private-db');
  });
});
