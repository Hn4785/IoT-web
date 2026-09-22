import { randomUUID } from 'node:crypto';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { AlertEvaluationService } from '../../../src/alert-config/alert-evaluation.service.js';
import { createApp } from '../../../src/app/create-app.js';
import { issueAccessToken } from '../../helpers/access-token.js';
import { createTestPrismaClient, prepareTestDatabase } from '../../helpers/database.js';
import { makeTestRuntimeConfig } from '../../helpers/runtime-config.js';

const describeDb = process.env.TEST_DATABASE_URL ? describe : describe.skip;

describeDb('Phase C in-app notifications', () => {
  let app: NestFastifyApplication;
  let prisma: ReturnType<typeof createTestPrismaClient>;
  let adminToken: string;
  let farmerToken: string;
  let outsiderToken: string;
  let clientToken: string;
  let farmerId: string;
  let farmId: string;
  let ruleId: string;
  let evaluator: AlertEvaluationService;

  beforeAll(async () => {
    prisma = createTestPrismaClient();
    await prepareTestDatabase();
    const [admin, farmer, outsider, client] = await Promise.all([
      prisma.user.create({
        data: {
          email: 'notifications-admin@example.test',
          displayName: 'Notifications Admin',
          passwordHash: 'test',
          role: 'ADMIN',
          status: 'ACTIVE',
        },
      }),
      prisma.user.create({
        data: {
          email: 'notifications-farmer@example.test',
          displayName: 'Notifications Farmer',
          passwordHash: 'test',
          role: 'FARMER',
          status: 'ACTIVE',
        },
      }),
      prisma.user.create({
        data: {
          email: 'notifications-outsider@example.test',
          displayName: 'Notifications Outsider',
          passwordHash: 'test',
          role: 'FARMER',
          status: 'ACTIVE',
        },
      }),
      prisma.user.create({
        data: {
          email: 'notifications-client@example.test',
          displayName: 'Notifications Client',
          passwordHash: 'test',
          role: 'CLIENT_DEVELOPER',
          status: 'ACTIVE',
        },
      }),
    ]);
    farmerId = farmer.id;
    const farm = await prisma.farm.create({ data: { name: 'Notification Farm' } });
    farmId = farm.id;
    await prisma.farmMembership.create({ data: { userId: farmer.id, farmId: farm.id } });
    const plot = await prisma.plot.create({ data: { farmId: farm.id, name: 'Notification Plot' } });
    const station = await prisma.station.create({
      data: { plotId: plot.id, upstreamCode: 'NOTIFY01', name: 'Notification Station' },
    });
    const rule = await prisma.alertRule.create({
      data: {
        stationId: station.id,
        field: 'MOISTURE',
        unit: '%',
        metadataRevision: 'test:v1:moisture',
        condition: { operator: 'BELOW', threshold: 20 },
        severity: 'CRITICAL',
        activeKey: `${station.id}:moisture`,
        evaluationState: { create: {} },
      },
    });
    ruleId = rule.id;
    const config = makeTestRuntimeConfig();
    const tokens = await Promise.all(
      [admin.id, farmer.id, outsider.id, client.id].map((userId) =>
        issueAccessToken({ prisma, config, userId }),
      ),
    );
    if (tokens.length !== 4) throw new Error('Expected four access tokens');
    [adminToken, farmerToken, outsiderToken, clientToken] = tokens as [
      string,
      string,
      string,
      string,
    ];
    app = await createApp(config);
    evaluator = app.get(AlertEvaluationService);
    await evaluator.evaluateRule(
      rule.id,
      { observedAt: new Date('2026-09-18T01:00:00Z'), value: 10, usable: true },
      'notification-open-1',
    );
    await evaluator.evaluateRule(
      rule.id,
      { observedAt: new Date('2026-09-18T01:01:00Z'), value: 11, usable: true },
      'notification-open-2',
    );
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  const list = (token: string, query = '') =>
    app.inject({
      method: 'GET',
      url: `/api/v1/notifications${query}`,
      headers: { authorization: `Bearer ${token}` },
    });

  it('creates one OPENED notification for each active eligible recipient', async () => {
    const notifications = await prisma.inAppNotification.findMany({
      where: { lifecycleEvent: { alert: { ruleId } } },
      include: { recipient: true },
      orderBy: { recipient: { email: 'asc' } },
    });
    expect(notifications.map((row) => row.recipient.email)).toEqual([
      'notifications-admin@example.test',
      'notifications-farmer@example.test',
    ]);
  });

  it('lists only caller notifications with complete DTO and unread count', async () => {
    const response = await list(farmerToken);
    expect(response.statusCode).toBe(200);
    const page = response.json<{
      data: {
        items: Array<{
          id: string;
          alertId: string;
          eventType: string;
          station: { code: string };
          field: string;
          severity: string;
          alertStatus: string;
          isRead: boolean;
          createdAt: string;
          readAt: string | null;
        }>;
        nextCursor: string | null;
        unreadCount: number;
      };
    }>().data;
    expect(page.unreadCount).toBe(1);
    expect(page.items).toHaveLength(1);
    expect(page.items[0]).toMatchObject({
      eventType: 'OPENED',
      station: { code: 'NOTIFY01' },
      field: 'moisture',
      severity: 'CRITICAL',
      alertStatus: 'OPEN',
      isRead: false,
      readAt: null,
    });
    expect(new Date(page.items[0]?.createdAt ?? '').toISOString()).toBe(page.items[0]?.createdAt);
  });

  it('delivers an ACKNOWLEDGED notification once per eligible recipient', async () => {
    const alert = await prisma.alert.findFirstOrThrow({ where: { ruleId } });
    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/alerts/${alert.id}/acknowledgements`,
      headers: { authorization: `Bearer ${adminToken}`, 'idempotency-key': randomUUID() },
      payload: { note: 'Reviewed' },
    });
    expect(response.statusCode).toBe(201);
    expect(
      await prisma.inAppNotification.count({
        where: { lifecycleEvent: { alertId: alert.id, type: 'ACKNOWLEDGED' } },
      }),
    ).toBe(2);
  });

  it('delivers a RESOLVED notification once per eligible recipient', async () => {
    const alert = await prisma.alert.findFirstOrThrow({ where: { ruleId } });
    await evaluator.evaluateRule(
      ruleId,
      { observedAt: new Date('2026-09-18T01:02:00Z'), value: 30, usable: true },
      'notification-normal',
    );
    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/alerts/${alert.id}/resolutions`,
      headers: { authorization: `Bearer ${adminToken}`, 'idempotency-key': randomUUID() },
      payload: {},
    });
    expect(response.statusCode).toBe(201);
    expect(
      await prisma.inAppNotification.count({
        where: { lifecycleEvent: { alertId: alert.id, type: 'RESOLVED' } },
      }),
    ).toBe(2);
  });

  it('denies Client Developer and hides notifications outside current farm membership', async () => {
    expect((await list(clientToken)).statusCode).toBe(403);
    expect((await list(outsiderToken)).json<{ data: { items: unknown[] } }>().data.items).toEqual(
      [],
    );

    await prisma.farmMembership.delete({ where: { userId_farmId: { userId: farmerId, farmId } } });
    expect(
      (await list(farmerToken)).json<{ data: { items: unknown[]; unreadCount: number } }>().data,
    ).toMatchObject({ items: [], unreadCount: 0 });
    await prisma.farmMembership.create({ data: { userId: farmerId, farmId } });
  });

  it('marks a notification read and unread idempotently', async () => {
    const unreadBefore = (await list(farmerToken, '?isRead=false')).json<{
      data: { unreadCount: number };
    }>().data.unreadCount;
    const notification = await prisma.inAppNotification.findFirstOrThrow({
      where: { recipientUserId: farmerId },
    });
    const patch = (isRead: boolean) =>
      app.inject({
        method: 'PATCH',
        url: `/api/v1/notifications/${notification.id}`,
        headers: { authorization: `Bearer ${farmerToken}` },
        payload: { isRead },
      });
    const read = await patch(true);
    expect(read.statusCode).toBe(200);
    const firstReadAt = read.json<{ data: { isRead: boolean; readAt: string | null } }>().data;
    expect(firstReadAt.isRead).toBe(true);
    expect(firstReadAt.readAt).not.toBeNull();
    expect((await patch(true)).json<{ data: { readAt: string | null } }>().data.readAt).toBe(
      firstReadAt.readAt,
    );
    expect(
      (await list(farmerToken, '?isRead=false')).json<{ data: { unreadCount: number } }>().data
        .unreadCount,
    ).toBe(unreadBefore - 1);
    const unread = await patch(false);
    expect(unread.json<{ data: { isRead: boolean; readAt: string | null } }>().data).toMatchObject({
      isRead: false,
      readAt: null,
    });
  });

  it('rejects malformed input, cross-recipient IDs and mismatched cursors', async () => {
    const adminNotification = await prisma.inAppNotification.findFirstOrThrow({
      where: { recipient: { email: 'notifications-admin@example.test' } },
    });
    const crossRecipient = await app.inject({
      method: 'PATCH',
      url: `/api/v1/notifications/${adminNotification.id}`,
      headers: { authorization: `Bearer ${farmerToken}` },
      payload: { isRead: true },
    });
    expect(crossRecipient.statusCode).toBe(404);
    const invalid = await app.inject({
      method: 'PATCH',
      url: `/api/v1/notifications/${randomUUID()}`,
      headers: { authorization: `Bearer ${farmerToken}` },
      payload: { isRead: 'yes', extra: true },
    });
    expect(invalid.statusCode).toBe(400);

    const first = await list(adminToken, '?limit=1&isRead=false');
    const cursor = first.json<{ data: { nextCursor: string | null } }>().data.nextCursor;
    expect(cursor).not.toBeNull();
    const mismatch = await list(
      adminToken,
      `?limit=1&isRead=true&cursor=${encodeURIComponent(cursor ?? '')}`,
    );
    expect(mismatch.statusCode).toBe(400);
  });

  it('reports device configuration unavailable only to browser roles', async () => {
    const capability = (token: string) =>
      app.inject({
        method: 'GET',
        url: '/api/v1/device-configurations/capability',
        headers: { authorization: `Bearer ${token}` },
      });
    for (const token of [adminToken, farmerToken]) {
      const response = await capability(token);
      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({
        success: true,
        data: { status: 'NOT_AVAILABLE', reasonCode: 'DEVICE_CONTRACT_PENDING' },
      });
    }
    expect((await capability(clientToken)).statusCode).toBe(403);
  });
});
