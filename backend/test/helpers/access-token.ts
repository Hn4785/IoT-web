import { randomBytes, randomUUID } from 'node:crypto';

import { SignJWT } from 'jose';

import type { RuntimeConfig } from '../../src/config/runtime-config.js';
import type { PrismaClient } from '../../src/generated/prisma/client.js';

export async function issueAccessToken(input: {
  prisma: PrismaClient;
  config: RuntimeConfig;
  userId: string;
}): Promise<string> {
  const session = await input.prisma.session.create({
    data: {
      userId: input.userId,
      tokenHash: randomBytes(32).toString('hex'),
      familyId: randomUUID(),
      expiresAt: new Date(Date.now() + 15 * 60_000),
    },
  });

  return new SignJWT({ sessionId: session.id })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(input.userId)
    .setIssuer('iot-api')
    .setAudience('iot-web')
    .setIssuedAt()
    .setExpirationTime('15m')
    .sign(new TextEncoder().encode(input.config.jwtSecret));
}
