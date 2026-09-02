import { Injectable } from '@nestjs/common';

import type { UserRole } from '../generated/prisma/enums.js';

@Injectable()
export class AuthorizationPolicy {
  canUseBrowserStationData(role: UserRole): boolean {
    return role === 'ADMIN' || role === 'FARMER';
  }

  canReceiveFarmMembership(role: UserRole): boolean {
    return role === 'FARMER';
  }

  canReceiveStationGrant(role: UserRole): boolean {
    return role === 'CLIENT_DEVELOPER';
  }
}
