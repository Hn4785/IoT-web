import { Inject, Injectable } from '@nestjs/common';

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

@Injectable()
export class WeatherClientService implements WeatherClient {
  constructor(@Inject(RUNTIME_CONFIG) private readonly config: RuntimeConfig) {}

  async getHealth(): Promise<WeatherHealth> {
    return parseWeatherHealthResponse(await this.getJson('/health')).data;
  }

  async listStations(): Promise<readonly string[]> {
    return parseWeatherStationsResponse(await this.getJson('/stations')).data;
  }

  async getLatest(query: LatestWeatherQuery): Promise<readonly WeatherLatestStation[]> {
    const search = new URLSearchParams();
    if (query.station) search.set('station', query.station.join(','));
    if (query.type) search.set('type', query.type.join(','));
    if (query.fields) search.set('fields', query.fields.join(','));

    return parseWeatherLatestResponse(await this.getJson('/data/latest', search)).data;
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
    search.set('aggregate', query.aggregate);

    return parseWeatherHistoryResponse(await this.getJson('/data/history', search)).data;
  }

  private async getJson(
    path: '/health' | '/stations' | '/data/latest' | '/data/history',
    query?: URLSearchParams,
  ): Promise<unknown> {
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
    const response = await fetch(url, request);
    if (!response.ok) {
      throw new Error('Weather upstream request failed');
    }

    return (await response.json()) as unknown;
  }
}
