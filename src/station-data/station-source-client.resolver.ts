import { Injectable, Logger } from '@nestjs/common';

import { AppError } from '../common/errors/app-error.js';
import { SourceSecretService } from '../data-sources/source-secret.service.js';
import { PrismaService } from '../database/prisma.service.js';
import { WeatherClientService } from '../integrations/weather/weather-client.service.js';

const SYSTEM_SOURCE_ID = '00000000-0000-0000-0000-000000000001';

@Injectable()
export class StationSourceClientResolver {
  private readonly logger = new Logger(StationSourceClientResolver.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly secrets: SourceSecretService,
    private readonly systemWeather: WeatherClientService,
  ) {}

  async resolve(dataSourceId: string): Promise<WeatherClientService> {
    if (dataSourceId === SYSTEM_SOURCE_ID) return this.systemWeather;
    const source = await this.prisma.dataSource.findUnique({
      where: { id: dataSourceId },
      select: {
        kind: true,
        baseUrl: true,
        keyCiphertext: true,
        keyNonce: true,
        keyAuthTag: true,
      },
    });
    if (
      !source ||
      source.kind !== 'MANAGED' ||
      !source.keyCiphertext ||
      !source.keyNonce ||
      !source.keyAuthTag
    ) {
      throw new AppError('UPSTREAM_UNAVAILABLE', 502, 'Connection failed');
    }
    const apiKey = this.secrets.decrypt({
      ciphertext: source.keyCiphertext,
      nonce: source.keyNonce,
      authTag: source.keyAuthTag,
    });
    return this.systemWeather.withConnection(source.baseUrl, apiKey);
  }

  async markConnected(dataSourceId: string, checkedAt: Date): Promise<void> {
    if (dataSourceId === SYSTEM_SOURCE_ID) return;
    try {
      await this.prisma.dataSource.updateMany({
        where: {
          id: dataSourceId,
          kind: 'MANAGED',
          removedAt: null,
          connectionStatus: 'FAILED',
        },
        data: { connectionStatus: 'CONNECTED', lastCheckedAt: checkedAt },
      });
    } catch {
      this.logger.warn(`Could not refresh connection status for data source ${dataSourceId}`);
    }
  }
}
