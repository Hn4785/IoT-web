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

const bootstrapInputSchema = z.strictObject({
  email: z
    .email()
    .max(254)
    .transform((value) => value.trim().toLowerCase()),
  displayName: z.string().trim().min(1).max(120),
});

export type BootstrapSuperAdminInput = z.input<typeof bootstrapInputSchema>;

export async function bootstrapSuperAdmin(
  prisma: PrismaClient,
  passwords: PasswordService,
  input: BootstrapSuperAdminInput,
  password: string,
): Promise<string> {
  const parsed = bootstrapInputSchema.parse(input);
  const passwordHash = await passwords.hash(password);

  try {
    return await prisma.$transaction(
      async (transaction) => {
        const [userCount, authorityCount] = await Promise.all([
          transaction.user.count(),
          transaction.systemAuthority.count(),
        ]);
        if (userCount !== 0 || authorityCount !== 0) {
          throw new AppError('CONFLICT', 409, 'Initial Super Admin already exists');
        }

        const user = await transaction.user.create({
          data: {
            email: parsed.email,
            displayName: parsed.displayName,
            passwordHash,
            passwordChangedAt: new Date(),
            role: 'ADMIN',
            status: 'ACTIVE',
          },
        });
        await transaction.systemAuthority.create({
          data: { authority: 'SUPER_ADMIN', holderUserId: user.id },
        });
        await transaction.securityAuditEvent.create({
          data: {
            actorUserId: user.id,
            action: 'SUPER_ADMIN_BOOTSTRAPPED',
            targetType: 'User',
            targetId: user.id,
            result: 'SUCCESS',
            requestId: 'bootstrap-cli',
            metadata: { source: 'interactive-cli' },
          },
        });

        return user.id;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      ['P2002', 'P2034'].includes(error.code)
    ) {
      throw new AppError('CONFLICT', 409, 'Initial Super Admin already exists');
    }
    throw error;
  }
}

async function promptSecret(prompt: string): Promise<string> {
  let muted = false;
  const output = new Writable({
    write(chunk: string | Uint8Array, encoding: BufferEncoding, callback: (error?: Error) => void) {
      if (!muted) {
        if (typeof chunk === 'string') {
          process.stdout.write(chunk, encoding);
        } else {
          process.stdout.write(chunk);
        }
      }
      callback();
    },
  });
  const promptReader = createInterface({ input: process.stdin, output, terminal: true });
  try {
    process.stdout.write(prompt);
    muted = true;
    const value = await promptReader.question('');
    muted = false;
    process.stdout.write('\n');
    return value;
  } finally {
    promptReader.close();
  }
}

function cliEmail(arguments_: readonly string[]): string {
  if (arguments_.some((argument) => argument.startsWith('--password'))) {
    throw new Error('Password command arguments are forbidden');
  }
  const index = arguments_.indexOf('--email');
  const value = index >= 0 ? arguments_[index + 1] : undefined;
  if (!value) {
    throw new Error('Usage: pnpm db:bootstrap-super-admin -- --email <email>');
  }
  return value;
}

async function main(): Promise<void> {
  const email = cliEmail(process.argv.slice(2));
  const firstPassword = await promptSecret('Initial password: ');
  const secondPassword = await promptSecret('Confirm password: ');
  if (firstPassword !== secondPassword) {
    throw new Error('Passwords do not match');
  }

  const config = parseRuntimeConfig(process.env);
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: config.databaseUrl }),
  });
  try {
    const id = await bootstrapSuperAdmin(
      prisma,
      new PasswordService(),
      { email, displayName: email.split('@')[0] ?? 'Super Admin' },
      firstPassword,
    );
    process.stdout.write(`Super Admin created (${id})\n`);
  } finally {
    await prisma.$disconnect();
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  await main();
}
