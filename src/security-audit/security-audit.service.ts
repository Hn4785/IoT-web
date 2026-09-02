import { Injectable } from '@nestjs/common';

import type { Prisma } from '../generated/prisma/client.js';

export type AuditInput = Readonly<{
  actorUserId: string;
  action: string;
  targetType: string;
  targetId: string;
  requestId: string;
  metadata?: Prisma.InputJsonObject;
}>;

@Injectable()
export class SecurityAuditService {
  async record(transaction: Prisma.TransactionClient, input: AuditInput): Promise<void> {
    await transaction.securityAuditEvent.create({
      data: {
        actorUserId: input.actorUserId,
        action: input.action,
        targetType: input.targetType,
        targetId: input.targetId,
        requestId: input.requestId,
        result: 'SUCCESS',
        metadata: input.metadata ?? {},
      },
    });
  }
}
