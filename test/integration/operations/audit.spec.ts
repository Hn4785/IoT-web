import { randomBytes, randomUUID } from 'node:crypto';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { SignJWT } from 'jose';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createApp } from '../../../src/app/create-app.js';
import { createTestPrismaClient, prepareTestDatabase } from '../../helpers/database.js';
import { makeTestRuntimeConfig } from '../../helpers/runtime-config.js';

const config = makeTestRuntimeConfig();
const prisma = createTestPrismaClient();
let app: NestFastifyApplication;
let rootToken: string;
let adminToken: string;
let farmerToken: string;
let developerToken: string;

async function accessToken(userId: string): Promise<string> {
  const session = await prisma.session.create({
    data: {
      userId,
      tokenHash: randomBytes(32).toString('hex'),
      familyId: randomUUID(),
      expiresAt: new Date(Date.now() + 15 * 60_000),
    },
  });
  return new SignJWT({ sessionId: session.id })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(userId)
    .setIssuer('iot-api')
    .setAudience('iot-web')
    .setIssuedAt()
    .setExpirationTime('15m')
    .sign(new TextEncoder().encode(config.jwtSecret));
}

function bearer(token: string): Record<string, string> {
  return { authorization: `Bearer ${token}` };
}

type AuditListResponse = {
  data: {
    items: Array<{
      id: string;
      actorUserId: string | null;
      action: string;
      targetType: string;
      targetId: string | null;
      result: string;
      requestId: string;
      metadata: Record<string, unknown>;
      createdAt: string;
    }>;
    nextCursor: string | null;
  };
};

describe('operations audit API', () => {
  beforeAll(async () => {
    await prepareTestDatabase();
    const root = await prisma.user.create({
      data: {
        email: 'd1-root@example.test',
        displayName: 'D1 Root',
        passwordHash: '$argon2id$test',
        role: 'ADMIN',
        status: 'ACTIVE',
      },
    });
    const admin = await prisma.user.create({
      data: {
        email: 'd1-admin@example.test',
        displayName: 'D1 Admin',
        passwordHash: '$argon2id$test',
        role: 'ADMIN',
        status: 'ACTIVE',
      },
    });
    const farmer = await prisma.user.create({
      data: {
        email: 'd1-farmer@example.test',
        displayName: 'D1 Farmer',
        passwordHash: '$argon2id$test',
        role: 'FARMER',
        status: 'ACTIVE',
      },
    });
    const developer = await prisma.user.create({
      data: {
        email: 'd1-developer@example.test',
        displayName: 'D1 Developer',
        passwordHash: '$argon2id$test',
        role: 'CLIENT_DEVELOPER',
        status: 'ACTIVE',
      },
    });
    await prisma.systemAuthority.create({
      data: { authority: 'SUPER_ADMIN', holderUserId: root.id },
    });
    [rootToken, adminToken, farmerToken, developerToken] = await Promise.all([
      accessToken(root.id),
      accessToken(admin.id),
      accessToken(farmer.id),
      accessToken(developer.id),
    ]);
    await prisma.securityAuditEvent.createMany({
      data: [
        {
          actorUserId: admin.id,
          action: 'USER_UPDATED',
          targetType: 'User',
          targetId: admin.id,
          result: 'SUCCESS',
          requestId: 'd1-old',
          metadata: { previousRole: 'FARMER', newRole: 'ADMIN' },
          createdAt: new Date('2026-09-20T01:00:00.000Z'),
        },
        {
          actorUserId: root.id,
          action: 'USER_PROVISIONED',
          targetType: 'User',
          targetId: admin.id,
          result: 'SUCCESS',
          requestId: 'd1-new',
          metadata: {
            role: 'ADMIN',
            password: 'must-not-appear',
            arbitrary: 'must-not-appear',
          },
          createdAt: new Date('2026-09-20T02:00:00.000Z'),
        },
      ],
    });
    app = await createApp(config);
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  it('returns a newest-first safe page only to the current Super Admin', async () => {
    const unauthenticated = await app.inject({
      method: 'GET',
      url: '/api/v1/admin/audit-events',
    });
    expect(unauthenticated.statusCode).toBe(401);

    for (const token of [adminToken, farmerToken, developerToken]) {
      const denied = await app.inject({
        method: 'GET',
        url: '/api/v1/admin/audit-events',
        headers: bearer(token),
      });
      expect(denied.statusCode).toBe(403);
    }

    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/admin/audit-events?limit=1',
      headers: bearer(rootToken),
    });
    expect(response.statusCode).toBe(200);
    const body = response.json<AuditListResponse>();
    expect(body.data.items).toHaveLength(1);
    expect(body.data.items[0]).toMatchObject({
      action: 'USER_PROVISIONED',
      result: 'SUCCESS',
      requestId: 'd1-new',
      metadata: { role: 'ADMIN' },
      createdAt: '2026-09-20T02:00:00.000Z',
    });
    expect(body.data.nextCursor).toEqual(expect.any(String));
    expect(response.body).not.toContain('must-not-appear');
  });

  it('binds cursors to allowlisted filters and rejects unknown query fields', async () => {
    const first = await app.inject({
      method: 'GET',
      url: '/api/v1/admin/audit-events?action=USER_UPDATED&limit=1',
      headers: bearer(rootToken),
    });
    expect(first.statusCode).toBe(200);
    expect(first.json<AuditListResponse>().data.items[0]?.action).toBe('USER_UPDATED');

    const page = await app.inject({
      method: 'GET',
      url: '/api/v1/admin/audit-events?limit=1',
      headers: bearer(rootToken),
    });
    const cursor = page.json<AuditListResponse>().data.nextCursor;
    const mismatch = await app.inject({
      method: 'GET',
      url: `/api/v1/admin/audit-events?action=USER_UPDATED&limit=1&cursor=${encodeURIComponent(cursor ?? '')}`,
      headers: bearer(rootToken),
    });
    expect(mismatch.statusCode).toBe(400);
    expect(mismatch.json()).toMatchObject({ error: { code: 'VALIDATION_ERROR' } });

    const unknown = await app.inject({
      method: 'GET',
      url: '/api/v1/admin/audit-events?email=root@example.test',
      headers: bearer(rootToken),
    });
    expect(unknown.statusCode).toBe(400);
  });
});
