import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';

import { AlertEvaluationService } from '../../src/alert-config/alert-evaluation.service.js';
import { createApp } from '../../src/app/create-app.js';
import { PasswordService } from '../../src/auth/password.service.js';
import { NotificationDeliveryWorker } from '../../src/notifications/notification-delivery.worker.js';
import { createTestPrismaClient, prepareTestDatabase } from './database.js';
import { makeTestRuntimeConfig } from './runtime-config.js';
import {
  startUpstreamServer,
  type UpstreamFixture,
  type UpstreamServer,
} from './upstream-server.js';

export function assertBrowserAcceptanceGuard(
  env: NodeJS.ProcessEnv = process.env,
  argv: string[] = process.argv,
): void {
  if (env.NODE_ENV === 'production')
    throw new Error('Refusing to run browser acceptance fixture in production');
  if (!argv.includes('--confirm-isolated-browser-fixture')) {
    throw new Error('Missing required confirmation flag: --confirm-isolated-browser-fixture');
  }
  const dbUrl = env.TEST_DATABASE_URL;
  if (!dbUrl) throw new Error('TEST_DATABASE_URL is required for browser acceptance fixture');
  const url = new URL(dbUrl);
  if (!['postgres:', 'postgresql:'].includes(url.protocol))
    throw new Error('Invalid database protocol');
  if (url.searchParams.get('schema') && url.searchParams.get('schema') !== 'public')
    throw new Error('Refusing non-public schema');
  if ([...url.searchParams.keys()].some((key) => key !== 'schema'))
    throw new Error('Refusing connection options');
  if (url.hostname !== 'localhost' && url.hostname !== '127.0.0.1') {
    throw new Error(
      `Refusing to run browser acceptance fixture on non-local host: ${url.hostname}`,
    );
  }
  if (url.port !== '5432') {
    throw new Error(
      `Refusing to run browser acceptance fixture on non-standard port: ${url.port || 'default'}`,
    );
  }
  if (url.pathname !== '/iot_test') {
    throw new Error(
      `Refusing to run browser acceptance fixture on non-test database: ${url.pathname}`,
    );
  }
  const password = env.QA_FIXTURE_PASSWORD;
  if (!password || password.length < 12)
    throw new Error('QA_FIXTURE_PASSWORD must be at least 12 characters');
}

const makeUpstreamHandler = (): UpstreamFixture => (req) => {
  const ts = Date.now();
  const sample = {
    ts,
    time: new Date(ts).toISOString(),
    _fieldTs: { moisture: ts, temperature: ts },
    moisture: 43.5,
    temperature: 25.2,
  };
  if (req.path.includes('/data/latest')) {
    return {
      status: 200,
      body: { success: true, data: [{ station: 'TESTNODE01', latest: { soil: sample } }] },
    };
  }
  if (req.path.includes('/data/history')) {
    return {
      status: 200,
      body: {
        success: true,
        data: [
          {
            station: 'TESTNODE01',
            history: {
              soil: [60 * 60_000, 30 * 60_000].map((offset) => ({
                ts: ts - offset,
                time: new Date(ts - offset).toISOString(),
                moisture: 42.1,
                temperature: 25.2,
              })),
            },
          },
        ],
      },
    };
  }
  return {
    status: 200,
    body: {
      success: true,
      data: {
        service: 'weather-api',
        version: '1.0.0',
        status: 'healthy',
        environment: 'test',
        ts: Date.now(),
        time: new Date().toISOString(),
      },
    },
  };
};

export async function setupBrowserAcceptanceFixture(): Promise<{
  app: NestFastifyApplication;
  upstream: UpstreamServer;
  close: () => Promise<void>;
}> {
  const env = process.env;
  assertBrowserAcceptanceGuard();

  const handler = makeUpstreamHandler();
  const upstreamResponses = Array.from({ length: 500 }, () => handler);
  const upstream = await startUpstreamServer(upstreamResponses);
  try {
    await prepareTestDatabase();
    const prisma = createTestPrismaClient();

    try {
      const passwordHash = await new PasswordService().hash(env.QA_FIXTURE_PASSWORD ?? '');
      const now = new Date();

      const userDefs: [
        string,
        string,
        'ADMIN' | 'FARMER' | 'CLIENT_DEVELOPER',
        'ACTIVE' | 'PENDING_PASSWORD_CHANGE',
        boolean,
      ][] = [
        ['qa-super@example.test', 'QA Super Admin', 'ADMIN', 'ACTIVE', true],
        ['qa-admin@example.test', 'QA Admin', 'ADMIN', 'ACTIVE', true],
        ['qa-farmer@example.test', 'QA Farmer', 'FARMER', 'ACTIVE', true],
        ['qa-client@example.test', 'QA Client Developer', 'CLIENT_DEVELOPER', 'ACTIVE', true],
        [
          'qa-temporary@example.test',
          'QA Temporary User',
          'FARMER',
          'PENDING_PASSWORD_CHANGE',
          false,
        ],
      ];
      const created = await Promise.all(
        userDefs.map(([email, displayName, role, status, pwdChanged]) =>
          prisma.user.create({
            data: {
              email,
              displayName,
              role,
              status,
              passwordHash,
              passwordChangedAt: pwdChanged ? now : null,
            },
          }),
        ),
      );
      const [superAdmin, admin, farmer, clientDev] = created;
      if (!superAdmin || !admin || !farmer || !clientDev)
        throw new Error('Failed creating QA fixture users');

      await prisma.systemAuthority.create({
        data: { authority: 'SUPER_ADMIN', holderUserId: superAdmin.id },
      });
      const farm = await prisma.farm.create({ data: { name: 'QA Farm' } });
      await prisma.farmMembership.create({ data: { farmId: farm.id, userId: farmer.id } });
      const plot = await prisma.plot.create({ data: { farmId: farm.id, name: 'QA Plot' } });
      const station = await prisma.station.create({
        data: {
          plotId: plot.id,
          upstreamCode: 'TESTNODE01',
          name: 'QA TESTNODE01 Station',
          dataSourceId: '00000000-0000-0000-0000-000000000001',
        },
      });
      await prisma.clientStationGrant.create({
        data: { userId: clientDev.id, stationId: station.id },
      });

      const rule = await prisma.alertRule.create({
        data: {
          stationId: station.id,
          field: 'MOISTURE',
          activeKey: `${station.id}:moisture`,
          unit: '%',
          metadataRevision: 'fixture-v1',
          condition: { operator: 'above', threshold: 40 },
          severity: 'WARNING',
        },
      });

      const baseTime = Date.now() - 101 * 60_000;
      const alerts = [];
      const events = [];
      const notifs = [];
      for (let i = 0; i < 101; i += 1) {
        const alertId = randomUUID();
        const eventId = randomUUID();
        const time = new Date(baseTime + i * 60_000);
        const isOpen = i === 100;
        alerts.push({
          id: alertId,
          ruleId: rule.id,
          unresolvedRuleId: isOpen ? rule.id : null,
          status: isOpen ? ('OPEN' as const) : ('RESOLVED' as const),
          openedValue: 42,
          latestValue: 42,
          openedObservedAt: time,
          latestObservedAt: time,
          openedAt: time,
        });
        events.push({
          id: eventId,
          alertId,
          type: 'OPENED' as const,
          revision: 1,
          requestId: `seed-${i.toString()}`,
          createdAt: time,
        });
        notifs.push({
          id: randomUUID(),
          lifecycleEventId: eventId,
          recipientUserId: farmer.id,
          isRead: i < 50,
          readAt: i < 50 ? new Date(time.getTime() + 10_000) : null,
          createdAt: time,
        });
      }
      await prisma.alert.createMany({ data: alerts });
      await prisma.alertLifecycleEvent.createMany({ data: events });
      await prisma.inAppNotification.createMany({ data: notifs });

      const auditDefs: [string, string, string, string, string, Record<string, string>, number][] =
        [
          [
            superAdmin.id,
            'SUPER_ADMIN_BOOTSTRAPPED',
            'User',
            superAdmin.id,
            'audit-0',
            { source: 'fixture' },
            10_000,
          ],
          [
            superAdmin.id,
            'USER_PROVISIONED',
            'User',
            admin.id,
            'audit-1',
            { role: 'ADMIN' },
            20_000,
          ],
          [admin.id, 'USER_PROVISIONED', 'User', farmer.id, 'audit-2', { role: 'FARMER' }, 30_000],
          [
            admin.id,
            'USER_PROVISIONED',
            'User',
            clientDev.id,
            'audit-3',
            { role: 'CLIENT_DEVELOPER' },
            40_000,
          ],
          [
            admin.id,
            'STATION_CREATED',
            'Station',
            station.id,
            'audit-4',
            { upstreamCode: 'TESTNODE01' },
            50_000,
          ],
        ];
      await prisma.securityAuditEvent.createMany({
        data: auditDefs.flatMap(
          ([actorUserId, action, targetType, targetId, requestId, metadata, ms]) =>
            Array.from({ length: 9 }, (_, index) => ({
              actorUserId,
              action,
              targetType,
              targetId,
              result: 'SUCCESS' as const,
              requestId: `${requestId}-${index.toString()}`,
              metadata,
              createdAt: new Date(baseTime + ms + index),
            })),
        ),
      });
    } finally {
      await prisma.$disconnect();
    }

    const app = await createApp(
      makeTestRuntimeConfig({
        port: 3001,
        frontendOrigin: 'http://127.0.0.1:5173',
        weatherApiBaseUrl: upstream.baseUrl,
        soilCollectionEnabled: false,
        nodeEnv: 'test',
      }),
    );
    try {
      app.get(AlertEvaluationService).onModuleDestroy();
    } catch {
      // no-op
    }
    try {
      app.get(NotificationDeliveryWorker).onModuleDestroy();
    } catch {
      // no-op
    }

    const close = async () => {
      await app.close();
      await upstream.close();
    };
    return { app, upstream, close };
  } catch (error) {
    await upstream.close();
    throw error;
  }
}

async function runCli(): Promise<void> {
  const { app, close } = await setupBrowserAcceptanceFixture();
  await app.listen(3001, '127.0.0.1');
  const shutdown = async () => {
    await close();
    process.exit(0);
  };
  process.once('SIGINT', () => void shutdown());
  process.once('SIGTERM', () => void shutdown());
  console.log('READY: http://127.0.0.1:3001');
  console.log(
    'Emails: qa-super@example.test, qa-admin@example.test, qa-farmer@example.test, qa-client@example.test, qa-temporary@example.test',
  );
}

const scriptArg = process.argv[1];
const isEntrypoint =
  typeof scriptArg === 'string' && resolve(scriptArg) === fileURLToPath(import.meta.url);
if (isEntrypoint) {
  runCli().catch((err: unknown) => {
    console.error(
      'Fatal error starting browser acceptance fixture:',
      err instanceof Error ? err.message : err,
    );
    process.exit(1);
  });
}
