import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createTestPrismaClient, prepareTestDatabase } from '../../helpers/database.js';

const prisma = createTestPrismaClient();

describe('data source database schema', () => {
  beforeAll(async () => {
    await prepareTestDatabase();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('scopes station codes to a source and records explicit Farmer grants', async () => {
    const [owner, grantee, farm] = await Promise.all([
      prisma.user.create({
        data: {
          email: 'source-owner@example.test',
          displayName: 'Source Owner',
          passwordHash: 'argon2id-test-marker',
          role: 'ADMIN',
          status: 'ACTIVE',
        },
      }),
      prisma.user.create({
        data: {
          email: 'source-farmer@example.test',
          displayName: 'Source Farmer',
          passwordHash: 'argon2id-test-marker',
          role: 'FARMER',
          status: 'ACTIVE',
        },
      }),
      prisma.farm.create({ data: { name: 'Source Farm' } }),
    ]);
    const plot = await prisma.plot.create({ data: { farmId: farm.id, name: 'Source Plot' } });
    const sourceData = {
      ownerUserId: owner.id,
      name: 'Observation API',
      baseUrl: 'https://weather.example/api/v1',
      keyCiphertext: 'ciphertext',
      keyNonce: 'nonce',
      keyAuthTag: 'tag',
      keyPreview: 'tail',
      connectionStatus: 'CONNECTED' as const,
      lastCheckedAt: new Date(),
    };
    const first = await prisma.dataSource.create({ data: sourceData });
    const second = await prisma.dataSource.create({
      data: { ...sourceData, name: 'Second Observation API' },
    });

    await prisma.station.createMany({
      data: [
        { plotId: plot.id, dataSourceId: first.id, upstreamCode: 'NODE01', name: 'Node 01' },
        { plotId: plot.id, dataSourceId: second.id, upstreamCode: 'NODE01', name: 'Node 01' },
      ],
    });
    await expect(
      prisma.station.create({
        data: {
          plotId: plot.id,
          dataSourceId: first.id,
          upstreamCode: 'NODE01',
          name: 'Duplicate Node',
        },
      }),
    ).rejects.toThrow();

    await prisma.dataSourceGrant.create({
      data: { dataSourceId: first.id, userId: grantee.id },
    });
    await expect(
      prisma.dataSourceGrant.create({
        data: { dataSourceId: first.id, userId: grantee.id },
      }),
    ).rejects.toThrow();
  });
});
