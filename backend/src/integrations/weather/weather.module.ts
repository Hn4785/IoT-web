import { Module } from '@nestjs/common';

import { OperationsModule } from '../../operations/operations.module.js';
import { WeatherClientService } from './weather-client.service.js';

@Module({
  imports: [OperationsModule],
  providers: [WeatherClientService],
  exports: [WeatherClientService],
})
export class WeatherModule {}
