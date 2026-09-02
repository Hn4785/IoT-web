import 'dotenv/config';

import { NestFactory } from '@nestjs/core';
import { randomUUID } from 'node:crypto';

import { AppModule } from '../app/app.module.js';
import { parseRuntimeConfig } from '../config/runtime-config.js';
import { RetentionService } from './retention.service.js';

const CONFIRMATION_FLAG = '--confirm-retention';

async function main(): Promise<void> {
  if (!process.argv.includes(CONFIRMATION_FLAG)) {
    throw new Error(`Retention requires the explicit ${CONFIRMATION_FLAG} flag`);
  }
  const context = await NestFactory.createApplicationContext(
    AppModule.register(parseRuntimeConfig(process.env)),
    { logger: false },
  );
  try {
    const result = await context.get(RetentionService).run(new Date(), `retention-${randomUUID()}`);
    process.stdout.write(`${JSON.stringify(result)}\n`);
  } finally {
    await context.close();
  }
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'Retention command failed';
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
