import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';
import { parseRuntimeConfig } from '../src/config/runtime-config.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

async function projectFile(path: string): Promise<string> {
  return readFile(resolve(root, path), 'utf8');
}

describe('delivery assets', () => {
  it('pins the supported runtime and runs as a non-root container user', async () => {
    const dockerfile = await projectFile('Dockerfile');

    expect(dockerfile).toContain('node:24.17.0-bookworm-slim');
    expect(dockerfile).toContain('pnpm@11.19.0');
    expect(dockerfile).toContain('pnpm install --frozen-lockfile');
    expect(dockerfile).toContain('USER node');
    expect(dockerfile).toContain('/api/v1/health');
  });

  it('keeps generated, secret and local data out of the image context', async () => {
    const dockerignore = await projectFile('.dockerignore');

    for (const entry of ['.env', '.git', 'node_modules', 'coverage', 'dist']) {
      expect(dockerignore).toContain(entry);
    }
  });

  it('runs immutable CI, database, security and image smoke gates', async () => {
    const workflow = await projectFile('.github/workflows/backend-ci.yml');

    for (const gate of [
      'pnpm install --frozen-lockfile',
      'pnpm verify',
      'pnpm test:coverage',
      'pnpm db:migrate:deploy',
      'pnpm audit --prod --audit-level=high',
      'pnpm security:secrets',
      'docker build',
      'pnpm release:check',
    ]) {
      expect(workflow).toContain(gate);
    }
  });

  it('provides bounded local recovery and release verification commands', async () => {
    const packageJson = await projectFile('package.json');
    const backup = await projectFile('scripts/operations/backup-restore-rehearsal.ps1');
    const release = await projectFile('scripts/verify-release.mjs');

    expect(packageJson).toContain('security:secrets');
    expect(packageJson).toContain('release:check');
    expect(backup).toContain('^iot_restore_[a-z0-9_]+$');
    expect(backup).toContain('pg_restore');
    expect(release).toContain('/api/v1/readiness');
    expect(release).toContain('/docs-json');
  });
  it('satisfies parseRuntimeConfig for CI job env and smoke docker env', async () => {
    const workflow = await projectFile('.github/workflows/backend-ci.yml');
    const verifyEnvMatch = workflow.match(/verify:\s*\n[\s\S]*?\s+env:\s*\n([\s\S]*?)\s+steps:/);
    const envBlock = verifyEnvMatch?.[1] ?? '';
    const jobEnv: Record<string, string> = {};
    for (const line of envBlock.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const idx = trimmed.indexOf(':');
      if (idx === -1) continue;
      const key = trimmed.slice(0, idx).trim();
      let val = trimmed.slice(idx + 1).trim();
      if ((val.startsWith("'") && val.endsWith("'")) || (val.startsWith('"') && val.endsWith('"')))
        val = val.slice(1, -1);
      jobEnv[key] = val;
    }
    const smokeMatch = workflow.match(/run:\s*\|\s*\n([\s\S]*?)(?:pnpm release:check|$)/);
    const smokeScript = smokeMatch?.[1] ?? '';
    const smokeEnv: Record<string, string> = {};
    for (const match of smokeScript.matchAll(/-e\s+([A-Z_]+)=([^\s\\]*)/g)) {
      if (match[1] && match[2] !== undefined) smokeEnv[match[1]] = match[2];
    }
    expect(parseRuntimeConfig(jobEnv).nodeEnv).toBe('test');
    expect(parseRuntimeConfig(smokeEnv).nodeEnv).toBe('production');
  });
});
