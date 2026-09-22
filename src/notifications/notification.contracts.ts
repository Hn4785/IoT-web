import type { SchemaObject } from '@nestjs/swagger';
import { z } from 'zod';

import { AppError } from '../common/errors/app-error.js';
import { soilAlertFieldSchema } from '../alert-config/alert-rule.contracts.js';

const listNotificationsSchema = z.strictObject({
  isRead: z
    .enum(['true', 'false'])
    .transform((value) => value === 'true')
    .optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  cursor: z.string().trim().min(1).max(2048).optional(),
});
const patchNotificationSchema = z.strictObject({ isRead: z.boolean() });

function parse<T>(schema: z.ZodType<T>, value: unknown, message: string): T {
  const result = schema.safeParse(value);
  if (!result.success) throw new AppError('VALIDATION_ERROR', 400, message);
  return result.data;
}

export type ListNotificationsQuery = z.infer<typeof listNotificationsSchema>;
export type PatchNotificationInput = z.infer<typeof patchNotificationSchema>;
export const parseListNotifications = (value: unknown) =>
  parse(listNotificationsSchema, value ?? {}, 'Notification query is invalid');
export const parsePatchNotification = (value: unknown) =>
  parse(patchNotificationSchema, value, 'Notification update is invalid');
export const parseNotificationId = (value: unknown) =>
  parse(z.uuid(), value, 'Notification ID is invalid');

export type InAppNotificationDto = Readonly<{
  id: string;
  alertId: string;
  eventType: 'OPENED' | 'ACKNOWLEDGED' | 'RESOLVED';
  station: Readonly<{ id: string; code: string; name: string }>;
  field: z.infer<typeof soilAlertFieldSchema>;
  severity: 'WARNING' | 'CRITICAL';
  alertStatus: 'OPEN' | 'ACKNOWLEDGED' | 'RESOLVED';
  isRead: boolean;
  createdAt: string;
  readAt: string | null;
}>;

export const notificationOpenApiSchema: SchemaObject = {
  type: 'object',
  additionalProperties: false,
  required: [
    'id',
    'alertId',
    'eventType',
    'station',
    'field',
    'severity',
    'alertStatus',
    'isRead',
    'createdAt',
    'readAt',
  ],
  properties: {
    id: { type: 'string', format: 'uuid' },
    alertId: { type: 'string', format: 'uuid' },
    eventType: { type: 'string', enum: ['OPENED', 'ACKNOWLEDGED', 'RESOLVED'] },
    station: {
      type: 'object',
      additionalProperties: false,
      required: ['id', 'code', 'name'],
      properties: {
        id: { type: 'string', format: 'uuid' },
        code: { type: 'string' },
        name: { type: 'string' },
      },
    },
    field: { type: 'string', enum: [...soilAlertFieldSchema.options] },
    severity: { type: 'string', enum: ['WARNING', 'CRITICAL'] },
    alertStatus: { type: 'string', enum: ['OPEN', 'ACKNOWLEDGED', 'RESOLVED'] },
    isRead: { type: 'boolean' },
    createdAt: { type: 'string', format: 'date-time' },
    readAt: { type: 'string', format: 'date-time', nullable: true },
  },
};
export const notificationEnvelopeOpenApiSchema: SchemaObject = {
  type: 'object',
  additionalProperties: false,
  required: ['success', 'data'],
  properties: { success: { type: 'boolean', enum: [true] }, data: notificationOpenApiSchema },
};
export const notificationPageEnvelopeOpenApiSchema: SchemaObject = {
  type: 'object',
  additionalProperties: false,
  required: ['success', 'data'],
  properties: {
    success: { type: 'boolean', enum: [true] },
    data: {
      type: 'object',
      additionalProperties: false,
      required: ['items', 'nextCursor', 'unreadCount'],
      properties: {
        items: { type: 'array', items: notificationOpenApiSchema },
        nextCursor: { type: 'string', nullable: true },
        unreadCount: { type: 'integer', minimum: 0 },
      },
    },
  },
};
export const patchNotificationOpenApiSchema: SchemaObject = {
  type: 'object',
  additionalProperties: false,
  required: ['isRead'],
  properties: { isRead: { type: 'boolean' } },
};

export function toNotificationDto(record: {
  id: string;
  isRead: boolean;
  createdAt: Date;
  readAt: Date | null;
  lifecycleEvent: {
    type: 'OPENED' | 'ACKNOWLEDGED' | 'RESOLVED';
    alert: {
      id: string;
      status: 'OPEN' | 'ACKNOWLEDGED' | 'RESOLVED';
      rule: {
        field: string;
        severity: 'WARNING' | 'CRITICAL';
        station: { id: string; upstreamCode: string; name: string };
      };
    };
  };
}): InAppNotificationDto {
  return {
    id: record.id,
    alertId: record.lifecycleEvent.alert.id,
    eventType: record.lifecycleEvent.type,
    station: {
      id: record.lifecycleEvent.alert.rule.station.id,
      code: record.lifecycleEvent.alert.rule.station.upstreamCode,
      name: record.lifecycleEvent.alert.rule.station.name,
    },
    field: soilAlertFieldSchema.parse(record.lifecycleEvent.alert.rule.field.toLowerCase()),
    severity: record.lifecycleEvent.alert.rule.severity,
    alertStatus: record.lifecycleEvent.alert.status,
    isRead: record.isRead,
    createdAt: record.createdAt.toISOString(),
    readAt: record.readAt?.toISOString() ?? null,
  };
}
