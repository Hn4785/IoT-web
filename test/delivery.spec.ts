import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

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
});
