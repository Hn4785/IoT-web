import { startUpstreamServer } from './upstream-server.js';

describe('startUpstreamServer', () => {
  it('serves a literal fixture and captures the actual request', async () => {
    const server = await startUpstreamServer([{ status: 200, body: { success: true, data: [] } }]);

    try {
      const response = await fetch(`${server.baseUrl}/api/v1/stations`, {
        headers: { 'x-api-key': 'test-key' },
      });

      expect(response.status).toBe(200);
      const responseBody = (await response.json()) as unknown;
      expect(responseBody).toEqual({ success: true, data: [] });
      expect(server.requests).toHaveLength(1);
      expect(server.requests[0]?.method).toBe('GET');
      expect(server.requests[0]?.path).toBe('/api/v1/stations');
      expect(server.requests[0]?.headers['x-api-key']).toBe('test-key');
    } finally {
      await server.close();
    }
  });

  it('serves an exact raw body with fixture headers', async () => {
    const server = await startUpstreamServer([
      {
        status: 503,
        rawBody: 'temporarily unavailable',
        headers: { 'content-type': 'text/plain', 'retry-after': '3' },
      },
    ]);

    try {
      const response = await fetch(`${server.baseUrl}/api/v1/health`);

      expect(response.status).toBe(503);
      expect(response.headers.get('content-type')).toBe('text/plain');
      expect(response.headers.get('retry-after')).toBe('3');
      expect(await response.text()).toBe('temporarily unavailable');
    } finally {
      await server.close();
    }
  });

  it('consumes fixtures in order and returns a bounded error when exhausted', async () => {
    const server = await startUpstreamServer([
      { status: 200, rawBody: 'first' },
      { status: 201, rawBody: 'second' },
    ]);

    try {
      const firstResponse = await fetch(`${server.baseUrl}/first`);
      const secondResponse = await fetch(`${server.baseUrl}/second`);
      const unexpectedResponse = await fetch(`${server.baseUrl}/third`);

      expect(firstResponse.status).toBe(200);
      expect(await firstResponse.text()).toBe('first');
      expect(secondResponse.status).toBe(201);
      expect(await secondResponse.text()).toBe('second');
      expect(unexpectedResponse.status).toBe(500);
      expect(await unexpectedResponse.text()).toBe('unexpected request');
      expect(server.requests.map(({ path }) => path)).toEqual(['/first', '/second', '/third']);
    } finally {
      await server.close();
    }
  });

  it('delays a fixture response by the configured duration', async () => {
    const server = await startUpstreamServer([{ status: 200, rawBody: 'slow', delayMs: 40 }]);

    try {
      const startedAt = performance.now();
      const response = await fetch(`${server.baseUrl}/slow`);
      const elapsedMs = performance.now() - startedAt;

      expect(await response.text()).toBe('slow');
      expect(elapsedMs).toBeGreaterThanOrEqual(30);
    } finally {
      await server.close();
    }
  });

  it('serves redirects without following them inside the helper', async () => {
    const server = await startUpstreamServer([
      { status: 302, headers: { location: '/api/v1/stations' } },
    ]);

    try {
      const response = await fetch(`${server.baseUrl}/redirect`, { redirect: 'manual' });

      expect(response.status).toBe(302);
      expect(response.headers.get('location')).toBe('/api/v1/stations');
      expect(server.requests.map(({ path }) => path)).toEqual(['/redirect']);
    } finally {
      await server.close();
    }
  });

  it('can select a fixture from the captured request path', async () => {
    const byPath = ({ path }: { path: string }) => ({ status: 200, rawBody: path });
    const server = await startUpstreamServer([byPath, byPath]);

    try {
      const second = await fetch(`${server.baseUrl}/second`);
      const first = await fetch(`${server.baseUrl}/first`);

      expect(await second.text()).toBe('/second');
      expect(await first.text()).toBe('/first');
    } finally {
      await server.close();
    }
  });

  it('can terminate a response after a bounded partial body', async () => {
    const server = await startUpstreamServer([
      {
        status: 200,
        rawBody: '{"success":true,"data":[',
        disconnectAfterBytes: 12,
      },
    ]);

    try {
      const response = await fetch(`${server.baseUrl}/cut-mid-body`);

      await expect(response.text()).rejects.toThrow();
      expect(server.requests.map(({ path }) => path)).toEqual(['/cut-mid-body']);
    } finally {
      await server.close();
    }
  });
});
