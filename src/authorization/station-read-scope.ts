import type { Prisma } from '../generated/prisma/client.js';
import type { CurrentPrincipalValue } from './current-principal.js';

/** One current-data boundary for hierarchy, readings, alerts and notifications. */
export function stationReadScope(principal: CurrentPrincipalValue): Prisma.StationWhereInput {
  const live = { dataSource: { removedAt: null }, upstreamCode: { not: 'CENTER' } };
  if (principal.status !== 'ACTIVE') return { id: '00000000-0000-4000-8000-000000000000' };
  if (principal.role === 'ADMIN') {
    return principal.isSuperAdmin
      ? live
      : {
          ...live,
          OR: [
            { dataSource: { kind: 'SYSTEM' } },
            { dataSource: { ownerUserId: principal.userId } },
          ],
        };
  }
  if (principal.role === 'FARMER') {
    return {
      ...live,
      OR: [
        {
          dataSource: { kind: 'SYSTEM' },
          plot: { farm: { memberships: { some: { userId: principal.userId } } } },
        },
        { dataSource: { ownerUserId: principal.userId } },
        { sourceGrants: { some: { userId: principal.userId } } },
      ],
    };
  }
  return { id: '00000000-0000-4000-8000-000000000000' };
}
