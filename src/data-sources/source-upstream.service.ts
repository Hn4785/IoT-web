import { Inject, Injectable } from '@nestjs/common';

import { AppError } from '../common/errors/app-error.js';
import { RUNTIME_CONFIG } from '../config/runtime-config.module.js';
import type { RuntimeConfig } from '../config/runtime-config.js';
import { parseWeatherStationsResponse } from '../integrations/weather/contracts.js';

const MAX_RESPONSE_BYTES = 1024 * 1024;

@Injectable()
export class SourceUpstreamService {
  constructor(@Inject(RUNTIME_CONFIG) private readonly config: RuntimeConfig) {}

  normalizeBaseUrl(value: string): string {
    const url = new URL(value);
    if (
      !this.config.dataSourceAllowedOrigins.includes(url.origin) ||
      url.username !== '' ||
      url.password !== '' ||
      url.search !== '' ||
      url.hash !== ''
    ) {
      throw new AppError('VALIDATION_ERROR', 400, 'API URL is not allowed');
    }
    return value.replace(/\/+$/, '');
  }

  async listStations(baseUrl: string, xApiKey: string): Promise<readonly string[]> {
    let response: Response;
    try {
      response = await fetch(`${baseUrl}/stations`, {
        method: 'GET',
        redirect: 'error',
        signal: AbortSignal.timeout(this.config.weatherApiTimeoutMs),
        headers: { 'x-api-key': xApiKey },
      });
    } catch (error) {
      throw new AppError('UPSTREAM_UNAVAILABLE', 502, 'Connection failed', { cause: error });
    }
    if (!response.ok) {
      await response.body?.cancel().catch(() => undefined);
      throw new AppError('UPSTREAM_UNAVAILABLE', 502, 'Connection failed');
    }
    const declaredLength = Number(response.headers.get('content-length'));
    if (Number.isFinite(declaredLength) && declaredLength > MAX_RESPONSE_BYTES) {
      await response.body?.cancel().catch(() => undefined);
      throw new AppError('UPSTREAM_INVALID_RESPONSE', 502, 'Connection returned invalid data');
    }
    let body: unknown;
    try {
      const text = await response.text();
      if (Buffer.byteLength(text, 'utf8') > MAX_RESPONSE_BYTES) {
        throw new Error('response too large');
      }
      body = JSON.parse(text) as unknown;
    } catch (error) {
      throw new AppError('UPSTREAM_INVALID_RESPONSE', 502, 'Connection returned invalid data', {
        cause: error,
      });
    }
    try {
      const stations = parseWeatherStationsResponse(body).data;
      if (stations.length === 0 || new Set(stations).size !== stations.length) {
        throw new Error('station list is empty or duplicated');
      }
      return stations;
    } catch (error) {
      throw new AppError('UPSTREAM_INVALID_RESPONSE', 502, 'Connection returned invalid data', {
        cause: error,
      });
    }
  }
}
