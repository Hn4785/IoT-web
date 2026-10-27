import { afterEach, describe, expect, it, vi } from 'vitest';

import type { CurrentPrincipalValue } from '../authorization/current-principal.js';
import { AppError } from '../common/errors/app-error.js';
import { DataSourceRepository } from './data-source.repository.js';
import { SourceConnectionStatusService } from './source-connection-status.service.js';
import { SourceSecretService } from './source-secret.service.js';
import { SourceUpstreamService } from './source-upstream.service.js';

const principal: CurrentPrincipalValue = {
  userId: 'viewer',
  sessionId: 'session',
  role: 'FARMER',
  status: 'ACTIVE',
  isSuperAdmin: false,
};

function fixture(probe: () => Promise<readonly string[]> = () => Promise.resolve(['NODE01'])) {
  const repository = {
    getVisibleConnection: vi.fn(() =>
      Promise.resolve({
        baseUrl: 'https://weather.example/api/v1',
        encrypted: { ciphertext: 'cipher', nonce: 'nonce', authTag: 'tag' },
      }),
    ),
    recordConnectionStatus: vi.fn(() => Promise.resolve()),
  };
  const upstream = { normalizeBaseUrl: (value: string) => value, listStations: vi.fn(probe) };
  const secrets = { decrypt: () => 'test-provider-credential' };
  const service = new SourceConnectionStatusService(
    repository as unknown as DataSourceRepository,
    secrets as unknown as SourceSecretService,
    upstream as unknown as SourceUpstreamService,
  );
  return { service, repository, upstream };
}

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('bounded source status checks', () => {
  it('expires a successful check instead of serving stale success after an outage', async () => {
    let now = Date.parse('2026-10-05T00:00:00.000Z');
    vi.useFakeTimers();
    vi.setSystemTime(now);
    let online = true;
    const { service, upstream } = fixture(() => {
      if (!online)
        return Promise.reject(new AppError('UPSTREAM_UNAVAILABLE', 502, 'private diagnostic'));
      return Promise.resolve(['NODE01']);
    });
    const initial = await service.check(principal, 'source');
    expect(initial.connectionStatus).toBe('CONNECTED');
    now += 29_999;
    vi.setSystemTime(now);
    expect(await service.check(principal, 'source')).toEqual({ ...initial, isFromCache: true });
    online = false;
    now += 1;
    vi.setSystemTime(now);
    const failed = await service.check(principal, 'source');
    expect(failed).toEqual({
      connectionStatus: 'FAILED',
      lastCheckedAt: '2026-10-05T00:00:30.000Z',
      isFromCache: false,
    });
    expect(upstream.listStations).toHaveBeenCalledTimes(2);
  });

  it('rechecks visibility before serving a warm cached result', async () => {
    const { service, repository, upstream } = fixture();
    await service.check(principal, 'source');
    repository.getVisibleConnection.mockRejectedValue(
      new AppError('NOT_FOUND', 404, 'Resource not found'),
    );
    await expect(service.check(principal, 'source')).rejects.toMatchObject({ statusCode: 404 });
    expect(upstream.listStations).toHaveBeenCalledTimes(1);
  });

  it('coalesces probes and rejects access revoked while the probe was in flight', async () => {
    let release!: (codes: string[]) => void;
    const { service, repository, upstream } = fixture(
      () =>
        new Promise((resolve) => {
          release = resolve;
        }),
    );
    const first = service.check(principal, 'source');
    const second = service.check(principal, 'source');
    await vi.waitFor(() => {
      expect(upstream.listStations).toHaveBeenCalledTimes(1);
    });
    repository.getVisibleConnection.mockRejectedValue(
      new AppError('NOT_FOUND', 404, 'Resource not found'),
    );
    release(['NODE01']);
    await expect(first).rejects.toMatchObject({ statusCode: 404 });
    await expect(second).rejects.toMatchObject({ statusCode: 404 });
  });

  it('bounds concurrent probes without falsely marking busy sources offline', async () => {
    const releases: Array<(codes: string[]) => void> = [];
    const { service, repository } = fixture(
      () =>
        new Promise((resolve) => {
          releases.push(resolve);
        }),
    );
    const tasks = [0, 1, 2, 3].map((id) => service.check(principal, `source-${id.toString()}`));
    await vi.waitFor(() => {
      expect(releases).toHaveLength(4);
    });
    await expect(service.check(principal, 'busy-source')).rejects.toMatchObject({
      code: 'REQUEST_IN_PROGRESS',
      statusCode: 503,
    });
    expect(repository.recordConnectionStatus).not.toHaveBeenCalled();
    releases.forEach((resolve) => {
      resolve(['NODE01']);
    });
    await Promise.all(tasks);
    const next = service.check(principal, 'next-source');
    await vi.waitFor(() => {
      expect(releases).toHaveLength(5);
    });
    releases[4]?.(['NODE01']);
    expect((await next).connectionStatus).toBe('CONNECTED');
  });

  it('does not convert database or internal failures to provider outages', async () => {
    const { service, repository } = fixture();
    repository.recordConnectionStatus.mockRejectedValue(
      new AppError('DATABASE_UNAVAILABLE', 503, 'Database unavailable'),
    );
    await expect(service.check(principal, 'source')).rejects.toMatchObject({
      code: 'DATABASE_UNAVAILABLE',
    });
  });

  it('rejects Client Developers before requesting any credential', async () => {
    const { service, repository } = fixture();
    await expect(
      service.check({ ...principal, role: 'CLIENT_DEVELOPER' }, 'source'),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect(repository.getVisibleConnection).not.toHaveBeenCalled();
  });
});
