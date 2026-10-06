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

    for (const entry of [
      '.env',
      '.git',
      'node_modules',
      'coverage',
      'dist',
      '.superpowers',
      '.agent-handoff',
    ]) {
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

  it('defines unpruned tools target and isolated pruned runtime target', async () => {
    const dockerfile = await projectFile('Dockerfile');
    const pinnedNode =
      'node:24.17.0-bookworm-slim@sha256:862263c612aa437e3037674b85419622a9d93bff80aa1eee5398dfe686375532';

    const fromLines = dockerfile
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.startsWith('FROM '));
    expect(fromLines.length).toBeGreaterThanOrEqual(3);
    for (const line of fromLines) {
      expect(line.startsWith(`FROM ${pinnedNode}`) || line.startsWith('FROM build AS')).toBe(true);
    }

    expect(dockerfile).toMatch(/FROM\s+build\s+AS\s+tools/);
    const toolsSection = dockerfile.split(/AS\s+tools/)[1]?.split(/AS\s+prune/)[0] ?? '';
    expect(toolsSection).toContain('USER node');
    expect(toolsSection).toContain(
      'COPY --chown=node:node scripts/operations ./scripts/operations',
    );
    expect(toolsSection).not.toContain('test');
    expect(toolsSection).toMatch(/chown\s+-R\s+node:node\s+\/app/);
    expect(toolsSection).toMatch(/CMD\s+\["pnpm",\s+"db:migrate:deploy"\]/);
    expect(toolsSection).not.toMatch(/CMD\s+\[.*(?:seed|reset|bootstrap|recover).*\]/);

    expect(dockerfile).toMatch(/FROM\s+build\s+AS\s+prune/);
    expect(dockerfile).toContain('pnpm prune --prod');

    const escapedPinnedNode = pinnedNode.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    expect(dockerfile).toMatch(new RegExp(`FROM\\s+${escapedPinnedNode}\\s+AS\\s+runtime`));
    expect(dockerfile).toContain(
      'COPY --from=prune --chown=node:node /app/package.json ./package.json',
    );
    expect(dockerfile).toContain(
      'COPY --from=prune --chown=node:node /app/node_modules ./node_modules',
    );
    expect(dockerfile).toContain('COPY --from=build --chown=node:node /app/dist ./dist');

    const runtimeSection = dockerfile.split(/AS\s+runtime/)[1] ?? '';
    expect(runtimeSection).not.toMatch(
      /COPY.*(?:\bsrc\b|\btest\b|\bprisma\b|\btsx\b|\.env|\.superpowers|fixtures|demo|scripts)/,
    );
    expect(runtimeSection).toContain('USER node');
    expect(runtimeSection).toContain('/api/v1/health');
  });

  it('prepares Corepack in a shared nonroot-readable cache for offline migrations', async () => {
    const dockerfile = await projectFile('Dockerfile');
    expect(dockerfile).toContain('ENV COREPACK_HOME=/pnpm/corepack');
    expect(dockerfile).toContain(
      'COPY --from=build --chown=node:node /root/.cache/node/corepack /pnpm/corepack',
    );
    expect(dockerfile).toContain('chown -R node:node /app /home/node /pnpm');
  });

  it('defines a valid, secret-free deployment Compose specification', async () => {
    const compose = await projectFile('deploy/compose.yaml');

    expect(compose).toContain(
      'postgres:17.6-alpine3.22@sha256:ef257d85f76e48da1c64832459b59fcaba1a4dac97bf5d7450c77753542eee94',
    );
    expect(compose).toContain('${API_IMAGE:?');
    expect(compose).toContain('${API_TOOLS_IMAGE:?');
    expect(compose).toContain('${WEB_IMAGE:?');
    expect(compose).not.toMatch(/^\s*build:/m);

    expect(compose).toMatch(/networks:\s*[\s\S]*?private:\s*[\s\S]*?internal:\s*true/);
    expect(compose).toMatch(/networks:\s*[\s\S]*?egress:/);

    expect(compose).toContain('postgres_data:');
    const postgresMatch = compose.match(
      / {2}postgres:\s*\n([\s\S]*?)(?=\n {2}[a-z0-9_-]+:|\n[a-z0-9_-]+:|$)/i,
    );
    const postgresBlock = postgresMatch?.[1] ?? '';
    expect(postgresBlock).toContain('postgres_data:/var/lib/postgresql/data');
    expect(postgresBlock).not.toContain('ports:');

    expect(compose).toMatch(/migration:\s*[\s\S]*?image:\s*\$\{API_TOOLS_IMAGE:\?/);
    expect(compose).toMatch(/migration:\s*[\s\S]*?profiles:\s*[\s\S]*?-\s*maintenance/);
    expect(compose).toMatch(
      /migration:\s*[\s\S]*?command:\s*(?:\["pnpm",\s*"db:migrate:deploy"\]|pnpm db:migrate:deploy)/,
    );
    expect(compose).toMatch(/migration:\s*[\s\S]*?restart:\s*["']?no["']?/);
    expect(compose).not.toMatch(/migration:\s*[\s\S]*?(?:seed|reset)/);

    expect(compose).toMatch(/api:\s*[\s\S]*?image:\s*\$\{API_IMAGE:\?/);
    expect(compose).toMatch(/api:\s*[\s\S]*?NODE_ENV:\s*production/);
    expect(compose).toMatch(/api:\s*[\s\S]*?PORT:\s*["']?3000["']?/);
    expect(compose).toMatch(/api:\s*[\s\S]*?ALERT_DEMO_METADATA_ENABLED:\s*["']?false["']?/);
    expect(compose).toMatch(
      /api:\s*[\s\S]*?depends_on:\s*[\s\S]*?postgres:\s*[\s\S]*?condition:\s*service_healthy/,
    );
    expect(compose).toMatch(
      /api:\s*[\s\S]*?depends_on:\s*[\s\S]*?migration:\s*[\s\S]*?condition:\s*service_completed_successfully/,
    );
    expect(compose).toMatch(/api:\s*[\s\S]*?healthcheck:\s*[\s\S]*?\/api\/v1\/readiness/);

    expect(compose).toMatch(/web:\s*[\s\S]*?image:\s*\$\{WEB_IMAGE:\?/);
    const webBlock = compose.split('  web:')[1]?.split('\nnetworks:')[0] ?? '';
    expect(webBlock).toMatch(/networks:\s*\n\s*- private\s*\n\s*- egress/);
    expect(compose).toMatch(
      /web:\s*[\s\S]*?ports:\s*[\s\S]*?-\s*["']?127\.0\.0\.1:\$\{WEB_PORT:-8080\}:8080["']?/,
    );
    expect(compose).toMatch(
      /web:\s*[\s\S]*?healthcheck:\s*[\s\S]*?http:\/\/127\.0\.0\.1:8080\/healthz/,
    );
    expect(compose).toMatch(
      /web:\s*[\s\S]*?depends_on:\s*[\s\S]*?api:\s*[\s\S]*?condition:\s*service_healthy/,
    );

    expect(compose).not.toContain('privileged: true');
    expect(compose).not.toContain('/var/run/docker.sock');
    expect(compose).not.toContain('network_mode: "host"');
    expect(compose).not.toContain('network_mode: host');
  });

  it('provides a complete, secret-free deployment environment example that satisfies runtime config', async () => {
    const envExample = await projectFile('deploy/.env.example');

    expect(envExample).toContain('COMPOSE_PROFILES=maintenance');
    expect(envExample).toContain('API_IMAGE=');
    expect(envExample).toContain('API_TOOLS_IMAGE=');
    expect(envExample).toContain('WEB_IMAGE=');
    expect(envExample).toContain('WEB_PORT=8080');

    expect(envExample).toContain('POSTGRES_DB=');
    expect(envExample).toContain('POSTGRES_USER=');
    expect(envExample).toContain('POSTGRES_PASSWORD=');

    expect(envExample).not.toMatch(/seed/i);

    const envVars: Record<string, string> = {};
    for (const line of envExample.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const idx = trimmed.indexOf('=');
      if (idx === -1) continue;
      const key = trimmed.slice(0, idx).trim();
      let val = trimmed.slice(idx + 1).trim();
      if (
        (val.startsWith("'") && val.endsWith("'")) ||
        (val.startsWith('"') && val.endsWith('"'))
      ) {
        val = val.slice(1, -1);
      }
      envVars[key] = val;
    }

    const config = parseRuntimeConfig(envVars);
    expect(config.nodeEnv).toBe('production');
    expect(config.databaseUrl).toContain('postgres:5432');
    expect(config.frontendOrigin).toBe('http://localhost:8080');
  });
});
