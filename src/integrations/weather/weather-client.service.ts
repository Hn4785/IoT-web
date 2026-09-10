import { Inject, Injectable } from '@nestjs/common';

import { AppError } from '../../common/errors/app-error.js';
import { RUNTIME_CONFIG } from '../../config/runtime-config.module.js';
import type { RuntimeConfig } from '../../config/runtime-config.js';
import {
  parseWeatherLatestResponse,
  parseWeatherHealthResponse,
  parseWeatherHistoryResponse,
  parseWeatherStationsResponse,
  type LatestWeatherQuery,
  type WeatherHealth,
  type WeatherHistoryQuery,
  type WeatherHistoryStation,
  type WeatherLatestStation,
} from './contracts.js';
import type { WeatherClient } from './weather-client.js';

type WeatherPath = '/health' | '/stations' | '/data/latest' | '/data/history';

interface RateLimitMetadata {
  limit: string | null;
  remaining: string | null;
  reset: string | null;
}

type UpstreamJson = Readonly<{
  body: unknown;
  rateLimit?: Readonly<RateLimitMetadata>;
}>;

function upstreamUnavailable(cause?: unknown): AppError {
  const options = cause === undefined ? undefined : { cause };
  return new AppError('UPSTREAM_UNAVAILABLE', 502, 'Weather service is unavailable', options);
}

function mapTransportError(error: unknown): AppError {
  if (error instanceof DOMException && error.name === 'TimeoutError') {
    return new AppError('UPSTREAM_TIMEOUT', 504, 'Weather service timed out', {
      cause: error,
    });
  }
  return upstreamUnavailable(error);
}

function parseUpstream<T>(parse: () => T): T {
  try {
    return parse();
  } catch (error) {
    throw upstreamUnavailable(error);
  }
}

function mapUpstreamStatus(status: number): AppError {
  if (status === 429) {
    return new AppError('RATE_LIMITED', 503, 'Weather service rate limit exceeded');
  }
  return upstreamUnavailable();
}

@Injectable()
export class WeatherClientService implements WeatherClient {
  constructor(@Inject(RUNTIME_CONFIG) private readonly config: RuntimeConfig) {}

  async getHealth(): Promise<WeatherHealth> {
    const { body } = await this.getJson('/health');
    return parseUpstream(() => parseWeatherHealthResponse(body).data);
  }

  async listStations(): Promise<readonly string[]> {
    const { body } = await this.getJson('/stations');
    return parseUpstream(() => parseWeatherStationsResponse(body).data);
  }

  async getLatest(query: LatestWeatherQuery): Promise<readonly WeatherLatestStation[]> {
    const search = new URLSearchParams();
    if (query.station) search.set('station', query.station.join(','));
    if (query.type) search.set('type', query.type.join(','));
    if (query.fields) search.set('fields', query.fields.join(','));

    const { body } = await this.getJson('/data/latest', search);
    return parseUpstream(() => parseWeatherLatestResponse(body).data);
  }

  async getHistory(query: WeatherHistoryQuery): Promise<readonly WeatherHistoryStation[]> {
    const search = new URLSearchParams();
    if (query.station) search.set('station', query.station.join(','));
    if (query.type) search.set('type', query.type.join(','));
    if (query.fields) search.set('fields', query.fields.join(','));
    if (query.begin) search.set('begin', query.begin);
    if (query.end) search.set('end', query.end);
    search.set('limit', query.limit.toString());
    search.set('order', query.order);
    search.set('interval', query.interval);
    if (query.aggregate) search.set('aggregate', query.aggregate);

    const { body } = await this.getJson('/data/history', search);
    return parseUpstream(() => parseWeatherHistoryResponse(body).data);
  }

  private async getJson(path: WeatherPath, query?: URLSearchParams): Promise<UpstreamJson> {
    const url = new URL(`${this.config.weatherApiBaseUrl}${path}`);
    if (query) url.search = query.toString();
    const request: RequestInit = {
      method: 'GET',
      redirect: 'error',
      signal: AbortSignal.timeout(this.config.weatherApiTimeoutMs),
    };
    if (path !== '/health') {
      request.headers = { 'x-api-key': this.config.weatherApiKey };
    }
    let response: Response;
    try {
      response = await fetch(url, request);
    } catch (error) {
      throw mapTransportError(error);
    }
    if (!response.ok) {
      throw mapUpstreamStatus(response.status);
    }

    let body: unknown;
    try {
      body = (await response.json()) as unknown;
    } catch (error) {
      throw upstreamUnavailable(error);
    }

    if (path === '/health') {
      return { body };
    }
    return {
      body,
      rateLimit: {
        limit: response.headers.get('x-ratelimit-limit'),
        remaining: response.headers.get('x-ratelimit-remaining'),
        reset: response.headers.get('x-ratelimit-reset'),
      },
    };
  }
}
