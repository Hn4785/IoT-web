import process from 'node:process';

const baseUrl = (process.env.RELEASE_BASE_URL ?? 'http://127.0.0.1:3000').replace(/\/$/, '');
const skipOpenApi = process.argv.includes('--skip-openapi');
const timeoutMs = Number(process.env.RELEASE_CHECK_TIMEOUT_MS ?? 5000);

async function json(path, expectedStatus = 200) {
  const response = await fetch(`${baseUrl}${path}`, { signal: AbortSignal.timeout(timeoutMs) });
  if (response.status !== expectedStatus) {
    throw new Error(`${path} returned HTTP ${response.status}; expected ${expectedStatus}`);
  }
  return response.json();
}

const health = await json('/api/v1/health');
if (health?.data?.status !== 'healthy') throw new Error('Liveness contract is not healthy');

const readiness = await json('/api/v1/readiness');
if (
  readiness?.data?.status !== 'ready' ||
  readiness?.data?.dependencies?.database?.status !== 'ready'
) {
  throw new Error('Readiness contract is not ready');
}

if (!skipOpenApi) {
  const openapi = await json('/docs-json');
  const requiredPaths = [
    '/api/v1/auth/login',
    '/api/v1/auth/me',
    '/api/v1/admin/users',
    '/api/v1/admin/audit-events',
    '/api/v1/farms',
    '/api/v1/stations/{stationId}/data/latest',
    '/api/v1/client/data/latest',
    '/api/v1/stations/{stationId}/alert-rules',
    '/api/v1/alerts',
    '/api/v1/notifications',
    '/api/v1/device-configurations/capability',
  ];
  const missing = requiredPaths.filter((path) => !openapi.paths?.[path]);
  if (missing.length > 0) throw new Error(`OpenAPI paths missing: ${missing.join(', ')}`);
}

console.log(`Release contract passed at ${baseUrl}${skipOpenApi ? ' (runtime only)' : ''}.`);
