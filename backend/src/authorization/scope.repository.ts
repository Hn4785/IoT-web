import { Injectable } from '@nestjs/common';

import { PrismaService } from '../database/prisma.service.js';
import type { CurrentPrincipalValue } from './current-principal.js';
import { stationReadScope } from './station-read-scope.js';

@Injectable()
export class ScopeRepository {
  constructor(private readonly prisma: PrismaService) {}

  async canReadStation(principal: CurrentPrincipalValue, stationId: string): Promise<boolean> {
    return (
      (await this.prisma.station.count({
        where: {
          AND: [{ id: stationId }, stationReadScope(principal)],
        },
      })) === 1
    );
  }
}
