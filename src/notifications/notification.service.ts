import { Injectable } from '@nestjs/common';

import type { CurrentPrincipalValue } from '../authorization/current-principal.js';
import { AppError } from '../common/errors/app-error.js';
import { PrismaService } from '../database/prisma.service.js';
import { decodeNotificationCursor, encodeNotificationCursor } from '../alert-config/cursor.js';
import {
  type InAppNotificationDto,
  type ListNotificationsQuery,
  type PatchNotificationInput,
  toNotificationDto,
} from './notification.contracts.js';

const notificationInclude = {
  lifecycleEvent: {
    include: {
      alert: {
        include: {
          rule: { include: { station: { select: { id: true, upstreamCode: true, name: true } } } },
        },
      },
    },
  },
} as const;

@Injectable()
export class NotificationService {
  constructor(private readonly prisma: PrismaService) {}

  async list(
    principal: CurrentPrincipalValue,
    query: ListNotificationsQuery,
  ): Promise<{ items: InAppNotificationDto[]; nextCursor: string | null; unreadCount: number }> {
    this.assertRole(principal);
    const cursor = query.cursor ? decodeNotificationCursor(query.cursor, query.isRead) : undefined;
    const scope = this.scope(principal);
    const rows = await this.prisma.inAppNotification.findMany({
      where: {
        ...scope,
        ...(query.isRead === undefined ? {} : { isRead: query.isRead }),
        ...(cursor
          ? {
              OR: [
                { createdAt: { lt: new Date(cursor.createdAt) } },
                { createdAt: new Date(cursor.createdAt), id: { lt: cursor.id } },
              ],
            }
          : {}),
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: query.limit + 1,
      include: notificationInclude,
    });
    const page = rows.slice(0, query.limit);
    const last = page.at(-1);
    const unreadCount = await this.prisma.inAppNotification.count({
      where: { ...scope, isRead: false },
    });
    return {
      items: page.map(toNotificationDto),
      nextCursor:
        rows.length > query.limit && last
          ? encodeNotificationCursor({
              v: 1,
              kind: 'notification',
              sort: 'createdAt_desc',
              isRead: query.isRead ?? null,
              createdAt: last.createdAt.toISOString(),
              id: last.id,
            })
          : null,
      unreadCount,
    };
  }

  async patch(
    principal: CurrentPrincipalValue,
    notificationId: string,
    input: PatchNotificationInput,
  ): Promise<InAppNotificationDto> {
    this.assertRole(principal);
    const scope = this.scope(principal);
    return this.prisma.$transaction(async (tx) => {
      const current = await tx.inAppNotification.findFirst({
        where: { id: notificationId, ...scope },
        include: notificationInclude,
      });
      if (!current) throw new AppError('NOT_FOUND', 404, 'Notification not found');
      if (current.isRead === input.isRead) return toNotificationDto(current);
      await tx.inAppNotification.updateMany({
        where: { id: notificationId, ...scope, isRead: { not: input.isRead } },
        data: { isRead: input.isRead, readAt: input.isRead ? new Date() : null },
      });
      const updated = await tx.inAppNotification.findFirst({
        where: { id: notificationId, ...scope },
        include: notificationInclude,
      });
      if (!updated) throw new AppError('NOT_FOUND', 404, 'Notification not found');
      return toNotificationDto(updated);
    });
  }

  private scope(principal: CurrentPrincipalValue) {
    return {
      recipientUserId: principal.userId,
      ...(principal.role === 'FARMER'
        ? {
            lifecycleEvent: {
              alert: {
                rule: {
                  station: {
                    plot: { farm: { memberships: { some: { userId: principal.userId } } } },
                  },
                },
              },
            },
          }
        : {}),
    };
  }

  private assertRole(principal: CurrentPrincipalValue): void {
    if (principal.status !== 'ACTIVE' || !['ADMIN', 'FARMER'].includes(principal.role)) {
      throw new AppError('FORBIDDEN', 403, 'Access is forbidden');
    }
  }
}
