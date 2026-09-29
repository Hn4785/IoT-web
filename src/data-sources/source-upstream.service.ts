import { Inject, Injectable } from '@nestjs/common';

import { AppError } from '../common/errors/app-error.js';
import { RUNTIME_CONFIG } from '../config/runtime-config.module.js';
import type { RuntimeConfig } from '../config/runtime-config.js';
import {
  parseWeatherLatestResponse,
  parseWeatherStationsResponse,
} from '../integrations/weather/contracts.js';
import { SOIL_FIELDS } from '../station-data/station-data.contracts.js';

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
    const body = await this.getJson(`${baseUrl}/stations`, xApiKey);
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

  async discoverSoilStations(baseUrl: string, xApiKey: string): Promise<readonly string[]> {
    const stationCodes = await this.listStations(baseUrl, xApiKey);
    const search = new URLSearchParams({ station: stationCodes.join(','), type: 'soil' });
    const body = await this.getJson(`${baseUrl}/data/latest?${search.toString()}`, xApiKey);
    let latest: ReturnType<typeof parseWeatherLatestResponse>['data'];
    try {
      latest = parseWeatherLatestResponse(body).data;
    } catch (error) {
      throw new AppError('UPSTREAM_INVALID_RESPONSE', 502, 'Connection returned invalid data', {
        cause: error,
      });
    }
    const discovered = new Set(stationCodes);
    const eligible = latest
      .filter(({ station, latest: readings }) => {
        if (station === 'CENTER' || !discovered.has(station) || !readings.soil) return false;
        return SOIL_FIELDS.some((field) => {
          const value = readings.soil?.[field];
          return typeof value === 'number' && Number.isFinite(value);
        });
      })
      .map(({ station }) => station);
    if (eligible.length === 0) {
      throw new AppError('NOT_SOIL_SOURCE', 422, 'Connection does not provide soil station data');
    }
    return [...new Set(eligible)];
  }

  private async getJson(url: string, xApiKey: string): Promise<unknown> {
    let response: Response;
    try {
      response = await fetch(url, {
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
    try {
      const text = await response.text();
      if (Buffer.byteLength(text, 'utf8') > MAX_RESPONSE_BYTES) {
        throw new Error('response too large');
      }
      return JSON.parse(text) as unknown;
    } catch (error) {
      throw new AppError('UPSTREAM_INVALID_RESPONSE', 502, 'Connection returned invalid data', {
        cause: error,
      });
    }
  }
}
