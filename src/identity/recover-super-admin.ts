import 'dotenv/config';

import { PrismaPg } from '@prisma/adapter-pg';
import { createInterface } from 'node:readline/promises';
import { Writable } from 'node:stream';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';

import { PasswordService } from '../auth/password.service.js';
import { AppError } from '../common/errors/app-error.js';
import { parseRuntimeConfig } from '../config/runtime-config.js';
import { Prisma, PrismaClient } from '../generated/prisma/client.js';

const emailSchema = z
  .email()
  .max(254)
  .transform((value) => value.trim().toLowerCase());

export async function recoverSuperAdmin(
  prisma: PrismaClient,
  passwords: PasswordService,
  email: string,
  password: string,
): Promise<string> {
  const normalizedEmail = emailSchema.parse(email);
  const passwordHash = await passwords.hash(password);

  return prisma.$transaction(
    async (transaction) => {
      const authority = await transaction.systemAuthority.findUnique({
        where: { authority: 'SUPER_ADMIN' },
        include: { holder: { select: { id: true, email: true, role: true } } },
      });
      if (!authority || authority.holder.email.toLowerCase() !== normalizedEmail) {
        throw new AppError('NOT_FOUND', 404, 'Super Admin account not found');
      }
      if (authority.holder.role !== 'ADMIN') {
        throw new AppError('CONFLICT', 409, 'Authority holder is not an Admin');
      }

      const now = new Date();
      await transaction.user.update({
        where: { id: authority.holder.id },
        data: {
          passwordHash,
          passwordChangedAt: now,
          status: 'ACTIVE',
          failedLoginCount: 0,
          lockedUntil: null,
        },
      });
      await transaction.session.updateMany({
        where: { userId: authority.holder.id, revokedAt: null },
        data: { revokedAt: now, revokeReason: 'SUPER_ADMIN_EMERGENCY_RECOVERY' },
      });
      await transaction.securityAuditEvent.create({
        data: {
          actorUserId: authority.holder.id,
          action: 'SUPER_ADMIN_EMERGENCY_RECOVERY',
          targetType: 'User',
          targetId: authority.holder.id,
          requestId: 'recovery-cli',
          result: 'SUCCESS',
          metadata: { source: 'interactive-cli' },
        },
      });
      return authority.holder.id;
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
}

async function promptSecret(prompt: string): Promise<string> {
  let muted = false;
  const output = new Writable({
    write(chunk: string | Uint8Array, encoding: BufferEncoding, callback) {
      if (!muted) {
        if (typeof chunk === 'string') process.stdout.write(chunk, encoding);
        else process.stdout.write(chunk);
      }
      callback();
    },
  });
  const reader = createInterface({ input: process.stdin, output, terminal: true });
  try {
    process.stdout.write(prompt);
    muted = true;
    const value = await reader.question('');
    muted = false;
    process.stdout.write('\n');
    return value;
  } finally {
    reader.close();
  }
}

function cliEmail(arguments_: readonly string[]): string {
  if (arguments_.some((argument) => argument.startsWith('--password'))) {
    throw new Error('Password command arguments are forbidden');
  }
  const index = arguments_.indexOf('--email');
  const value = index >= 0 ? arguments_[index + 1] : undefined;
  if (!value) throw new Error('Usage: pnpm db:recover-super-admin -- --email <email>');
  return value;
}

async function main(): Promise<void> {
  const email = cliEmail(process.argv.slice(2));
  const first = await promptSecret('New Super Admin password: ');
  const second = await promptSecret('Confirm password: ');
  if (first !== second) throw new Error('Passwords do not match');

  const config = parseRuntimeConfig(process.env);
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: config.databaseUrl }),
  });
  try {
    const id = await recoverSuperAdmin(prisma, new PasswordService(), email, first);
    process.stdout.write(`Super Admin recovered (${id})\n`);
  } finally {
    await prisma.$disconnect();
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  await main();
}
