import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createApp } from '../../../src/app/create-app.js';
import { RetentionService } from '../../../src/identity/retention.service.js';
import { createTestPrismaClient, prepareTestDatabase } from '../../helpers/database.js';
import { makeTestRuntimeConfig } from '../../helpers/runtime-config.js';

const prisma = createTestPrismaClient();
const now = new Date('2026-09-02T00:00:00.000Z');
const daysAgo = (days: number) => new Date(now.getTime() - days * 24 * 60 * 60_000);

describe('identity retention boundary', () => {
  let app: Awaited<ReturnType<typeof createApp>>;
  let retention: RetentionService;

  beforeAll(async () => {
    await prepareTestDatabase();
    app = await createApp(makeTestRuntimeConfig());
    retention = app.get(RetentionService);
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  it('purges expired credentials and anonymizes only eligible non-authority users', async () => {
    const [root, oldDeletion, recentDeletion, client] = await Promise.all([
      prisma.user.create({
        data: {
          email: 'root@example.test',
          displayName: 'Root',
          passwordHash: 'root-hash',
          role: 'ADMIN',
          status: 'ACTIVE',
          deletionRequestedAt: daysAgo(120),
        },
      }),
      prisma.user.create({
        data: {
          email: 'old-delete@example.test',
          displayName: 'Old Delete',
          passwordHash: 'old-hash',
          role: 'FARMER',
          status: 'DISABLED',
          deletionRequestedAt: daysAgo(91),
        },
      }),
      prisma.user.create({
        data: {
          email: 'recent-delete@example.test',
          displayName: 'Recent Delete',
          passwordHash: 'recent-hash',
          role: 'FARMER',
          status: 'DISABLED',
          deletionRequestedAt: daysAgo(89),
        },
      }),
      prisma.user.create({
        data: {
          email: 'client@example.test',
          displayName: 'Client',
          passwordHash: 'client-hash',
          role: 'CLIENT_DEVELOPER',
          status: 'ACTIVE',
        },
      }),
    ]);
    await prisma.systemAuthority.create({
      data: { authority: 'SUPER_ADMIN', holderUserId: root.id },
    });
    await Promise.all([
      prisma.session.create({
        data: {
          userId: recentDeletion.id,
          tokenHash: 'a'.repeat(64),
          familyId: '11111111-1111-4111-8111-111111111111',
          expiresAt: daysAgo(31),
        },
      }),
      prisma.session.create({
        data: {
          userId: recentDeletion.id,
          tokenHash: 'b'.repeat(64),
          familyId: '22222222-2222-4222-8222-222222222222',
          expiresAt: daysAgo(29),
        },
      }),
      prisma.apiKey.create({
        data: {
          ownerUserId: client.id,
          name: 'Old expired',
          prefix: 'old_expired',
          keyHash: 'c'.repeat(64),
          expiresAt: daysAgo(91),
        },
      }),
      prisma.apiKey.create({
        data: {
          ownerUserId: client.id,
          name: 'Recent expired',
          prefix: 'recent_expired',
          keyHash: 'd'.repeat(64),
          expiresAt: daysAgo(89),
        },
      }),
      prisma.securityAuditEvent.create({
        data: {
          actorUserId: oldDeletion.id,
          action: 'RECENT_EVIDENCE',
          targetType: 'User',
          targetId: oldDeletion.id,
          result: 'SUCCESS',
          requestId: 'retention-test',
          createdAt: daysAgo(364),
        },
      }),
    ]);

    await expect(retention.run(now, 'retention-run-test')).resolves.toEqual({
      sessionsPurged: 1,
      usersAnonymized: 1,
      apiKeysPurged: 1,
    });

    expect(await prisma.session.count()).toBe(1);
    expect(await prisma.apiKey.count()).toBe(1);
    const anonymized = await prisma.user.findUniqueOrThrow({ where: { id: oldDeletion.id } });
    expect(anonymized).toMatchObject({
      email: `anonymous-${oldDeletion.id}@deleted.invalid`,
      displayName: 'Deleted user',
      status: 'DISABLED',
    });
    expect(anonymized.anonymizedAt?.toISOString()).toBe(now.toISOString());
    expect(
      (await prisma.user.findUniqueOrThrow({ where: { id: root.id } })).anonymizedAt,
    ).toBeNull();
    expect(
      (await prisma.user.findUniqueOrThrow({ where: { id: recentDeletion.id } })).anonymizedAt,
    ).toBeNull();
    expect(await prisma.securityAuditEvent.count({ where: { action: 'RECENT_EVIDENCE' } })).toBe(1);
    expect(
      await prisma.securityAuditEvent.count({ where: { action: 'RETENTION_COMPLETED' } }),
    ).toBe(1);
  });
});
