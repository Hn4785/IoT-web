import { Module } from '@nestjs/common';

import { WeatherClientService } from './weather-client.service.js';

@Module({
  providers: [WeatherClientService],
  exports: [WeatherClientService],
})
export class WeatherModule {}
