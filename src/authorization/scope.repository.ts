import { Injectable } from '@nestjs/common';

import { PrismaService } from '../database/prisma.service.js';

@Injectable()
export class ScopeRepository {
  constructor(private readonly prisma: PrismaService) {}

  async stationExists(stationId: string): Promise<boolean> {
    return (await this.prisma.station.count({ where: { id: stationId } })) === 1;
  }

  async farmerCanReadStation(userId: string, stationId: string): Promise<boolean> {
    return (
      (await this.prisma.station.count({
        where: {
          id: stationId,
          plot: { farm: { memberships: { some: { userId } } } },
        },
      })) === 1
    );
  }
}
