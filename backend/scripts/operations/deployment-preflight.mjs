import { execFile } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { statfs } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import dotenv from 'dotenv';
import { parseRuntimeConfig } from '../../src/config/runtime-config.ts';

const execute = promisify(execFile);
const imageKeys = ['API_IMAGE', 'API_TOOLS_IMAGE', 'WEB_IMAGE'];
const migrationList = (value) =>
  Array.isArray(value) &&
  value.length > 0 &&
  value.length <= 1024 &&
  value.every(
    (id, index) =>
      typeof id === 'string' &&
      /^\d{14}_[a-z0-9_]+$/.test(id) &&
      (index === 0 || id > value[index - 1]),
  );
const version = (value) =>
  String(value ?? '')
    .trim()
    .match(/^v?(\d+)\.(\d+)(?:\.\d+)?(?:[-+][\w.-]+)?$/);
/** Syntax/config/evidence checks only: never pull images, alter DB or apply a release. */
export function validateDeploymentPreflight(input) {
  const { profile, env, manifest } = input;
  const checks = [],
    errors = [];
  const check = (name, okay) => (okay ? checks : errors).push(name);
  check('PROFILE', ['pi', 'server'].includes(profile));
  check('CPU_ARCH', ['x64', 'amd64', 'arm64'].includes(input.cpuArch));
  check('FREE_DISK', Number.isFinite(input.freeBytes) && input.freeBytes >= 2 * 1024 ** 3);
  const node = version(input.nodeVersion),
    docker = version(input.dockerVersion),
    compose = version(input.composeVersion);
  check('NODE_VERSION', node && Number(node[1]) === 24 && Number(node[2]) >= 17);
  check('DOCKER_VERSION', docker && Number(docker[1]) >= 25);
  check(
    'COMPOSE_VERSION',
    compose && (Number(compose[1]) > 2 || (Number(compose[1]) === 2 && Number(compose[2]) >= 24)),
  );
  check(
    'IMAGE_DIGESTS',
    imageKeys.every((name) =>
      /^[a-zA-Z0-9][a-zA-Z0-9._:/-]*@sha256:[a-f0-9]{64}$/.test(env[name] ?? ''),
    ),
  );
  let config;
  try {
    config = parseRuntimeConfig(env);
  } catch {
    /* Never include validation input/errors in output. */
  }
  check(
    'RUNTIME_CONFIG',
    config?.nodeEnv === 'production' && config.port === 3000 && !config.alertDemoMetadataEnabled,
  );
  const secretOkay = (value) =>
    typeof value === 'string' &&
    value.length >= 32 &&
    new Set(value).size >= 8 &&
    !/replace-with|placeholder|change[-_]?me|example|test-secret/i.test(value);
  check(
    'SECRET_POLICY',
    secretOkay(env.JWT_SECRET) &&
      secretOkay(env.CREDENTIAL_PEPPER) &&
      env.JWT_SECRET !== env.CREDENTIAL_PEPPER,
  );
  const key = env.DATA_SOURCE_ENCRYPTION_KEY ?? '';
  check(
    'ENCRYPTION_KEY',
    /^[A-Za-z0-9+/]{43}=$/.test(key) &&
      Buffer.from(key, 'base64').length === 32 &&
      Buffer.from(key, 'base64').toString('base64') === key,
  );
  let originOkay = false;
  try {
    const url = new URL(env.FRONTEND_ORIGIN);
    originOkay =
      !url.username &&
      !url.password &&
      url.pathname === '/' &&
      !url.search &&
      !url.hash &&
      (url.protocol === 'https:' ||
        (profile === 'pi' &&
          url.protocol === 'http:' &&
          ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)));
  } catch {
    /* Invalid origin stays false; do not echo credentials. */
  }
  check('FRONTEND_ORIGIN', originOkay);
  const validManifest =
    manifest &&
    !Array.isArray(manifest) &&
    typeof manifest === 'object' &&
    manifest.schemaVersion === 1 &&
    /^[a-f0-9]{7,64}$/.test(manifest.releaseRevision ?? '') &&
    migrationList(manifest.migrationIds) &&
    typeof manifest.existingData === 'boolean';
  check('RELEASE_MANIFEST', validManifest);
  if (validManifest && manifest.existingData) {
    check('BACKUP_EVIDENCE', manifest.backupVerified === true);
    check(
      'MIGRATION_COMPATIBILITY',
      migrationList(manifest.databaseMigrations) &&
        manifest.databaseMigrations.every((id, index) => manifest.migrationIds[index] === id),
    );
  }
  return {
    valid: errors.length === 0,
    profile,
    checks,
    errors,
    limitations: [
      'Manifest validation is not proof of restore, image content or target acceptance.',
    ],
  };
}

async function main(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 2) {
    if (
      !['--profile', '--manifest', '--env-file'].includes(argv[index]) ||
      !argv[index + 1] ||
      options[argv[index]]
    ) {
      throw new Error('ARGUMENTS');
    }
    options[argv[index]] = argv[index + 1];
  }
  if (!options['--manifest'] || !['pi', 'server'].includes(options['--profile']))
    throw new Error('ARGUMENTS');
  const manifest = JSON.parse(readFileSync(options['--manifest'], 'utf8'));
  // An explicitly selected target file must not be overridden by a workstation's env.
  const env = options['--env-file']
    ? dotenv.parse(readFileSync(options['--env-file']))
    : process.env;
  const disk = await statfs(process.cwd());
  const [docker, compose] = await Promise.all([
    execute('docker', ['version', '--format', '{{.Server.Version}}'], { timeout: 15000 }),
    execute('docker', ['compose', 'version', '--short'], { timeout: 15000 }),
  ]);
  const result = validateDeploymentPreflight({
    profile: options['--profile'],
    env,
    manifest,
    cpuArch: process.arch,
    freeBytes: disk.bavail * disk.bsize,
    nodeVersion: process.version,
    dockerVersion: docker.stdout.trim(),
    composeVersion: compose.stdout.trim(),
  });
  console.log(JSON.stringify(result));
  if (!result.valid) process.exitCode = 1;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2)).catch(() => {
    console.error('PREFLIGHT_FAILED: arguments, files or Docker unavailable');
    process.exitCode = 1;
  });
}
