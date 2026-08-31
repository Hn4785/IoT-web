import { createServer } from 'node:http';

export interface UpstreamResponse {
  status: number;
  body?: unknown;
  rawBody?: string;
  headers?: Readonly<Record<string, string>>;
  delayMs?: number;
}

export interface CapturedRequest {
  method: string;
  path: string;
  headers: Readonly<Record<string, string | string[] | undefined>>;
}

export interface UpstreamServer {
  baseUrl: string;
  requests: CapturedRequest[];
  close(): Promise<void>;
}

export async function startUpstreamServer(
  responses: readonly UpstreamResponse[],
): Promise<UpstreamServer> {
  const requests: CapturedRequest[] = [];
  let responseIndex = 0;
  const server = createServer((request, response) => {
    requests.push({
      method: request.method ?? '',
      path: request.url ?? '',
      headers: { ...request.headers },
    });

    const fixture = responses[responseIndex];
    responseIndex += 1;

    if (!fixture) {
      response.statusCode = 500;
      response.end('unexpected request');
      return;
    }

    const sendFixture = () => {
      response.statusCode = fixture.status;
      for (const [name, value] of Object.entries(fixture.headers ?? {})) {
        response.setHeader(name, value);
      }

      if (fixture.rawBody !== undefined) {
        response.end(fixture.rawBody);
        return;
      }

      if (!response.hasHeader('content-type')) {
        response.setHeader('content-type', 'application/json');
      }
      response.end(JSON.stringify(fixture.body));
    };

    if (fixture.delayMs === undefined) {
      sendFixture();
      return;
    }

    setTimeout(sendFixture, fixture.delayMs);
  });

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      server.off('error', reject);
      resolve();
    });
  });

  const address = server.address();
  if (!address || typeof address === 'string') {
    server.close();
    throw new Error('Upstream test server did not bind to a TCP port');
  }

  return {
    baseUrl: `http://127.0.0.1:${address.port.toString()}`,
    requests,
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.close((error) => {
          if (error) {
            reject(error);
            return;
          }

          resolve();
        });
      }),
  };
}
