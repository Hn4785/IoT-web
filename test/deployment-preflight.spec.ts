import { randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import dotenv from 'dotenv';
import { describe, expect, it } from 'vitest';
import { validateDeploymentPreflight } from '../scripts/operations/deployment-preflight.mjs';

const base = () => ({
  profile: 'server',
  cpuArch: 'amd64',
  freeBytes: 3 * 1024 ** 3,
  nodeVersion: '24.17.0',
  dockerVersion: '29.7.2',
  composeVersion: '2.39.2',
  env: {
    ...dotenv.parse(readFileSync('deploy/.env.example')),
    FRONTEND_ORIGIN: 'https://monitor.example.org',
    JWT_SECRET: randomBytes(32).toString('hex'),
    CREDENTIAL_PEPPER: randomBytes(32).toString('hex'),
    DATA_SOURCE_ENCRYPTION_KEY: randomBytes(32).toString('base64'),
    API_IMAGE: `api@sha256:${'a'.repeat(64)}`,
    API_TOOLS_IMAGE: `tools@sha256:${'b'.repeat(64)}`,
    WEB_IMAGE: `web@sha256:${'c'.repeat(64)}`,
  },
  manifest: {
    schemaVersion: 1,
    releaseRevision: 'a'.repeat(40),
    migrationIds: ['20260902075712_identity_foundation'],
    existingData: true,
    backupVerified: true,
    databaseMigrations: ['20260902075712_identity_foundation'],
  },
});
describe('read-only deployment preflight', () => {
  it('accepts the actual process.version Node prefix', () => {
    const request = base();
    request.nodeVersion = 'v24.17.0';
    expect(validateDeploymentPreflight(request).valid).toBe(true);
  });
  it('accepts explicit server and LAN Pi profiles', () => {
    expect(validateDeploymentPreflight(base()).valid).toBe(true);
    const request = base();
    request.profile = 'pi';
    request.cpuArch = 'arm64';
    request.env.FRONTEND_ORIGIN = 'https://192.168.1.9';
    expect(validateDeploymentPreflight(request).valid).toBe(true);
  });
  it.each(['http://192.168.1.9', 'http://farm.lan'])(
    'rejects Pi HTTP origin %s that cannot retain Secure production cookies',
    (origin) => {
      const request = base();
      request.profile = 'pi';
      request.env.FRONTEND_ORIGIN = origin;
      expect(validateDeploymentPreflight(request).errors).toContain('FRONTEND_ORIGIN');
    },
  );
  it.each(['unknown', ''])('does not guess profile %s', (profile) => {
    expect(validateDeploymentPreflight({ ...base(), profile }).valid).toBe(false);
  });
  it.each([NaN, Infinity, -1, 1024])('rejects invalid available disk %s', (freeBytes) => {
    expect(validateDeploymentPreflight({ ...base(), freeBytes }).valid).toBe(false);
  });
  it.each(['api:latest', 'https://user:password@api@sha256:' + 'a'.repeat(64)])(
    'rejects mutable or credential-bearing image references',
    (image) => {
      const request = base();
      request.env.API_IMAGE = image;
      expect(validateDeploymentPreflight(request).valid).toBe(false);
    },
  );
  it.each(['schemaVersion1', '1', 2])('requires the exact manifest schema %s', (schemaVersion) => {
    const request = base();
    expect(
      validateDeploymentPreflight({ ...request, manifest: { ...request.manifest, schemaVersion } })
        .valid,
    ).toBe(false);
  });
  it.each([
    { migrationIds: [] },
    { migrationIds: ['bad'] },
    { migrationIds: ['20260902075712_identity_foundation', '20260902075712_identity_foundation'] },
  ])('rejects invalid migration evidence', ({ migrationIds }) => {
    const request = base();
    request.manifest.migrationIds = migrationIds;
    expect(validateDeploymentPreflight(request).valid).toBe(false);
  });
  it('requires verified backup and compatible observed migrations for existing data', () => {
    const request = base();
    request.manifest.backupVerified = false;
    expect(validateDeploymentPreflight(request).valid).toBe(false);
    request.manifest.backupVerified = true;
    request.manifest.databaseMigrations = ['20269999999999_future'];
    expect(validateDeploymentPreflight(request).valid).toBe(false);
  });
  it.each([
    'http://monitor.example.org',
    'https://u:secret@monitor.example.org',
    'https://monitor.example.org/path',
  ])('rejects unsafe server origin', (origin) => {
    const request = base();
    request.env.FRONTEND_ORIGIN = origin;
    expect(validateDeploymentPreflight(request).valid).toBe(false);
  });
  it('reports only fixed error identifiers, never secret/config values', () => {
    const request = base();
    const secret = request.env.JWT_SECRET;
    request.env.CREDENTIAL_PEPPER = secret;
    request.nodeVersion = '';
    request.dockerVersion = '24.0.0';
    request.composeVersion = '2.20.0';
    const result = validateDeploymentPreflight(request);
    expect(result.valid).toBe(false);
    expect(JSON.stringify(result)).not.toContain(secret);
    expect(result.limitations.join(' ')).toContain('not proof of restore');
  });
});
