import { SignJWT } from 'jose';
import { randomBytes, randomUUID } from 'node:crypto';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createApp } from '../../../src/app/create-app.js';
import { createTestPrismaClient, prepareTestDatabase } from '../../helpers/database.js';
import { makeTestRuntimeConfig } from '../../helpers/runtime-config.js';

const config = makeTestRuntimeConfig();
const prisma = createTestPrismaClient();
let app: NestFastifyApplication;
let rootToken: string;
let adminToken: string;

type ProvisionResponse = {
  data: {
    user: { email: string; role: string; status: string; isSuperAdmin: boolean };
    temporaryPassword: string;
  };
};

type ErrorResponse = { error: { code: string } };
type UserListResponse = { data: { items: unknown[]; nextCursor: string | null } };
type OpenApiResponse = {
  paths: Record<string, unknown>;
  components?: { securitySchemes?: Record<string, unknown> };
};

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

describe('administrator user provisioning', () => {
  beforeAll(async () => {
    await prepareTestDatabase();
    const root = await prisma.user.create({
      data: {
        email: 'root@example.test',
        displayName: 'Root Admin',
        passwordHash: '$argon2id$test',
        role: 'ADMIN',
        status: 'ACTIVE',
      },
    });
    const admin = await prisma.user.create({
      data: {
        email: 'admin@example.test',
        displayName: 'Normal Admin',
        passwordHash: '$argon2id$test',
        role: 'ADMIN',
        status: 'ACTIVE',
      },
    });
    await prisma.systemAuthority.create({
      data: { authority: 'SUPER_ADMIN', holderUserId: root.id },
    });
    [rootToken, adminToken] = await Promise.all([accessToken(root.id), accessToken(admin.id)]);
    app = await createApp(config);
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  it('allows the Super Admin to provision any role and returns a secret once', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/admin/users',
      headers: bearer(rootToken),
      payload: {
        email: 'FARMER@Example.test',
        displayName: 'Farmer A',
        role: 'FARMER',
      },
    });

    expect(response.statusCode).toBe(201);
    expect(response.headers['cache-control']).toBe('no-store');
    const body = response.json<ProvisionResponse>();
    expect(body.data.user).toMatchObject({
      email: 'farmer@example.test',
      role: 'FARMER',
      status: 'PENDING_PASSWORD_CHANGE',
      isSuperAdmin: false,
    });
    expect(body.data.temporaryPassword).toMatch(/^.{20}$/);
    expect(response.body).not.toContain('passwordHash');
  });

  it('allows normal Admin provisioning only for non-Admin roles', async () => {
    const clientResponse = await app.inject({
      method: 'POST',
      url: '/api/v1/admin/users',
      headers: bearer(adminToken),
      payload: {
        email: 'client@example.test',
        displayName: 'Client A',
        role: 'CLIENT_DEVELOPER',
      },
    });
    expect(clientResponse.statusCode).toBe(201);

    const adminResponse = await app.inject({
      method: 'POST',
      url: '/api/v1/admin/users',
      headers: bearer(adminToken),
      payload: {
        email: 'blocked-admin@example.test',
        displayName: 'Blocked Admin',
        role: 'ADMIN',
      },
    });
    expect(adminResponse.statusCode).toBe(403);
    expect(adminResponse.json<ErrorResponse>().error.code).toBe('FORBIDDEN');
  });

  it('requires a valid active Admin and resolves authority from the database', async () => {
    const missing = await app.inject({ method: 'GET', url: '/api/v1/admin/users' });
    expect(missing.statusCode).toBe(401);

    const farmer = await prisma.user.findUniqueOrThrow({ where: { email: 'farmer@example.test' } });
    await prisma.user.update({ where: { id: farmer.id }, data: { status: 'ACTIVE' } });
    const farmerResponse = await app.inject({
      method: 'GET',
      url: '/api/v1/admin/users',
      headers: bearer(await accessToken(farmer.id)),
    });
    expect(farmerResponse.statusCode).toBe(403);
  });

  it('rejects unknown fields and normalized duplicate emails', async () => {
    const unknownField = await app.inject({
      method: 'POST',
      url: '/api/v1/admin/users',
      headers: bearer(rootToken),
      payload: {
        email: 'unknown@example.test',
        displayName: 'Unknown',
        role: 'FARMER',
        unexpected: true,
      },
    });
    expect(unknownField.statusCode).toBe(400);

    const duplicate = await app.inject({
      method: 'POST',
      url: '/api/v1/admin/users',
      headers: bearer(rootToken),
      payload: {
        email: 'farmer@EXAMPLE.test',
        displayName: 'Duplicate Farmer',
        role: 'FARMER',
      },
    });
    expect(duplicate.statusCode).toBe(409);
  });

  it('revokes credentials atomically on role changes and protects the authority holder', async () => {
    const farmer = await prisma.user.findUniqueOrThrow({
      where: { email: 'farmer@example.test' },
    });
    await prisma.session.create({
      data: {
        userId: farmer.id,
        tokenHash: 'a'.repeat(64),
        familyId: '11111111-1111-4111-8111-111111111111',
        expiresAt: new Date(Date.now() + 60_000),
      },
    });
    await prisma.apiKey.create({
      data: {
        ownerUserId: farmer.id,
        name: 'test',
        prefix: 'iot_test_farmer',
        keyHash: 'b'.repeat(64),
        expiresAt: new Date(Date.now() + 60_000),
      },
    });

    const update = await app.inject({
      method: 'PATCH',
      url: `/api/v1/admin/users/${farmer.id}`,
      headers: bearer(rootToken),
      payload: { role: 'CLIENT_DEVELOPER' },
    });
    expect(update.statusCode).toBe(200);
    await expect(
      prisma.session.count({ where: { userId: farmer.id, revokedAt: null } }),
    ).resolves.toBe(0);
    await expect(
      prisma.apiKey.count({ where: { ownerUserId: farmer.id, revokedAt: null } }),
    ).resolves.toBe(0);

    const protectedRoot = await app.inject({
      method: 'PATCH',
      url: `/api/v1/admin/users/${await prisma.systemAuthority
        .findUniqueOrThrow({ where: { authority: 'SUPER_ADMIN' } })
        .then((authority) => authority.holderUserId)}`,
      headers: bearer(rootToken),
      payload: { status: 'DISABLED' },
    });
    expect(protectedRoot.statusCode).toBe(409);

    const normalAdmin = await prisma.user.findUniqueOrThrow({
      where: { email: 'admin@example.test' },
    });
    const mutateSelf = await app.inject({
      method: 'PATCH',
      url: `/api/v1/admin/users/${normalAdmin.id}`,
      headers: bearer(adminToken),
      payload: { displayName: 'Not Allowed' },
    });
    expect(mutateSelf.statusCode).toBe(403);
  });

  it('preserves credentials when role and status are unchanged', async () => {
    const user = await prisma.user.create({
      data: {
        email: 'unchanged-client@example.test',
        displayName: 'Unchanged Client',
        passwordHash: '$argon2id$test',
        role: 'CLIENT_DEVELOPER',
        status: 'ACTIVE',
      },
    });
    await prisma.session.create({
      data: {
        userId: user.id,
        tokenHash: 'c'.repeat(64),
        familyId: randomUUID(),
        expiresAt: new Date(Date.now() + 60_000),
      },
    });
    await prisma.apiKey.create({
      data: {
        ownerUserId: user.id,
        name: 'unchanged-test',
        prefix: 'iot_test_unchanged',
        keyHash: 'd'.repeat(64),
        expiresAt: new Date(Date.now() + 60_000),
      },
    });

    const update = await app.inject({
      method: 'PATCH',
      url: `/api/v1/admin/users/${user.id}`,
      headers: bearer(rootToken),
      payload: { role: 'CLIENT_DEVELOPER', status: 'ACTIVE' },
    });

    expect(update.statusCode).toBe(200);
    await expect(
      prisma.session.count({ where: { userId: user.id, revokedAt: null } }),
    ).resolves.toBe(1);
    await expect(
      prisma.apiKey.count({ where: { ownerUserId: user.id, revokedAt: null } }),
    ).resolves.toBe(1);
  });

  it('lists safe DTOs and resets a permitted password with no-store', async () => {
    const list = await app.inject({
      method: 'GET',
      url: '/api/v1/admin/users?limit=2',
      headers: bearer(adminToken),
    });
    expect(list.statusCode).toBe(200);
    expect(list.headers['cache-control']).toBe('no-store');
    expect(list.body).not.toContain('passwordHash');
    expect(list.json<UserListResponse>().data.items).toHaveLength(2);
    expect(list.json<UserListResponse>().data.nextCursor).toMatch(/^[0-9a-f-]{36}$/);

    const client = await prisma.user.findUniqueOrThrow({ where: { email: 'client@example.test' } });
    const reset = await app.inject({
      method: 'POST',
      url: `/api/v1/admin/users/${client.id}/reset-password`,
      headers: bearer(adminToken),
    });
    expect(reset.statusCode).toBe(201);
    expect(reset.headers['cache-control']).toBe('no-store');
    expect(reset.json<ProvisionResponse>().data.temporaryPassword).toMatch(/^.{20}$/);
    expect(reset.body).not.toContain('passwordHash');
  });

  it('prevents the Super Admin from resetting its own password over HTTP', async () => {
    const root = await prisma.systemAuthority.findUniqueOrThrow({
      where: { authority: 'SUPER_ADMIN' },
      select: { holderUserId: true },
    });
    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/admin/users/${root.holderUserId}/reset-password`,
      headers: bearer(rootToken),
    });

    expect(response.statusCode).toBe(409);
    expect(response.json<ErrorResponse>().error.code).toBe('CONFLICT');
  });

  it('publishes provisioning and authentication contracts without password hashes', async () => {
    const response = await app.inject({ method: 'GET', url: '/docs-json' });
    const document = response.json<OpenApiResponse>();

    expect(document.paths).toHaveProperty('/api/v1/admin/users');
    expect(document.paths).toHaveProperty('/api/v1/admin/users/{userId}');
    expect(document.paths).toHaveProperty('/api/v1/admin/users/{userId}/reset-password');
    expect(document.paths).toHaveProperty('/api/v1/auth/login');
    expect(document.paths).toHaveProperty('/api/v1/auth/me');
    expect(document.paths).toHaveProperty('/api/v1/auth/change-password');
    expect(document.components?.securitySchemes).toHaveProperty('bearer');
    expect(response.body).not.toContain('passwordHash');
  });
});
