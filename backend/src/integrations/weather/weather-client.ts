import type {
  LatestWeatherQuery,
  WeatherHealth,
  WeatherHistoryQuery,
  WeatherHistoryStation,
  WeatherLatestStation,
} from './contracts.js';

export interface WeatherClient {
  getHealth(): Promise<WeatherHealth>;
  listStations(): Promise<readonly string[]>;
  getLatest(query: LatestWeatherQuery): Promise<readonly WeatherLatestStation[]>;
  getHistory(query: WeatherHistoryQuery): Promise<readonly WeatherHistoryStation[]>;
}
