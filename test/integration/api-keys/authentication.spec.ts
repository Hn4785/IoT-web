import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createApp } from '../../../src/app/create-app.js';
import { ApiKeyService } from '../../../src/api-keys/api-key.service.js';
import { TokenHashService } from '../../../src/auth/token-hash.service.js';
import { AppError } from '../../../src/common/errors/app-error.js';
import { createTestPrismaClient, prepareTestDatabase } from '../../helpers/database.js';
import { makeTestRuntimeConfig } from '../../helpers/runtime-config.js';

const config = makeTestRuntimeConfig();
const prisma = createTestPrismaClient();
const tokenHashes = new TokenHashService(config.credentialPepper);

describe('API-key authentication', () => {
  let app: Awaited<ReturnType<typeof createApp>>;
  let service: ApiKeyService;
  let client: { id: string };
  let station: { id: string };
  let otherStation: { id: string };
  const validKey = 'iot_live_AbCd1234_abcdefghijklmnopqrstuvwxyzABCDEFGH123456789';

  beforeAll(async () => {
    await prepareTestDatabase();
    client = await prisma.user.create({
      data: {
        email: 'client@example.test',
        displayName: 'Client',
        passwordHash: 'test',
        role: 'CLIENT_DEVELOPER',
        status: 'ACTIVE',
      },
    });
    const farm = await prisma.farm.create({ data: { name: 'Farm' } });
    const plot = await prisma.plot.create({ data: { farmId: farm.id, name: 'Plot' } });
    [station, otherStation] = await Promise.all([
      prisma.station.create({
        data: { plotId: plot.id, upstreamCode: 'one', name: 'One' },
      }),
      prisma.station.create({
        data: { plotId: plot.id, upstreamCode: 'two', name: 'Two' },
      }),
    ]);
    await prisma.clientStationGrant.create({ data: { userId: client.id, stationId: station.id } });
    await prisma.apiKey.create({
      data: {
        ownerUserId: client.id,
        name: 'Valid',
        prefix: 'AbCd1234',
        keyHash: tokenHashes.hash(validKey),
        expiresAt: new Date(Date.now() + 60_000),
        scopes: { create: { stationId: station.id } },
      },
    });
    app = await createApp(config);
    service = app.get(ApiKeyService);
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  it('returns a bounded principal for a current account grant and key scope', async () => {
    await expect(service.authenticate(validKey, station.id)).resolves.toMatchObject({
      ownerUserId: client.id,
      stationId: station.id,
      requestsPerMinute: 60,
    });
  });

  it('uses one safe denial for malformed, wrong-scope, expired, revoked and disabled-owner keys', async () => {
    async function expectDenied(key: string, stationId: string) {
      try {
        await service.authenticate(key, stationId);
        throw new Error('Expected key authentication to fail');
      } catch (error) {
        expect(error).toBeInstanceOf(AppError);
        expect(error).toMatchObject({ code: 'INVALID_API_KEY', statusCode: 401 });
      }
    }

    await expectDenied('malformed', station.id);
    await expectDenied(validKey, 'not-a-uuid');
    await expectDenied(validKey, otherStation.id);

    const stored = await prisma.apiKey.findFirstOrThrow({ where: { prefix: 'AbCd1234' } });
    await prisma.apiKey.update({
      where: { id: stored.id },
      data: { expiresAt: new Date(Date.now() - 1) },
    });
    await expectDenied(validKey, station.id);

    await prisma.apiKey.update({
      where: { id: stored.id },
      data: { expiresAt: new Date(Date.now() + 60_000), revokedAt: new Date() },
    });
    await expectDenied(validKey, station.id);

    await prisma.apiKey.update({ where: { id: stored.id }, data: { revokedAt: null } });
    await prisma.user.update({ where: { id: client.id }, data: { status: 'DISABLED' } });
    await expectDenied(validKey, station.id);
  });

  it('fails closed immediately when the account-level station grant is removed', async () => {
    await prisma.user.update({ where: { id: client.id }, data: { status: 'ACTIVE' } });
    await prisma.clientStationGrant.delete({
      where: { userId_stationId: { userId: client.id, stationId: station.id } },
    });
    await expect(service.authenticate(validKey, station.id)).rejects.toMatchObject({
      code: 'INVALID_API_KEY',
    });
  });
});
