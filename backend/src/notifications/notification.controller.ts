import { Body, Controller, Get, Header, Param, Patch, Query, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOkResponse,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';

import { AccessTokenGuard } from '../authorization/access-token.guard.js';
import {
  CurrentPrincipal,
  type CurrentPrincipalValue,
} from '../authorization/current-principal.js';
import {
  notificationEnvelopeOpenApiSchema,
  notificationPageEnvelopeOpenApiSchema,
  parseListNotifications,
  parseNotificationId,
  parsePatchNotification,
  patchNotificationOpenApiSchema,
} from './notification.contracts.js';
import { NotificationService } from './notification.service.js';

@ApiTags('notifications')
@ApiBearerAuth()
@UseGuards(AccessTokenGuard)
@Controller('notifications')
export class NotificationController {
  constructor(private readonly notifications: NotificationService) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  @ApiQuery({ name: 'isRead', required: false, enum: ['true', 'false'] })
  @ApiQuery({
    name: 'limit',
    required: false,
    schema: { type: 'integer', minimum: 1, maximum: 100 },
  })
  @ApiQuery({ name: 'cursor', required: false, schema: { type: 'string', maxLength: 2048 } })
  @ApiOkResponse({ schema: notificationPageEnvelopeOpenApiSchema })
  @ApiResponse({ status: 400, description: 'Invalid request' })
  @ApiResponse({ status: 401, description: 'Authentication required' })
  @ApiResponse({ status: 403, description: 'Access forbidden' })
  async list(@CurrentPrincipal() principal: CurrentPrincipalValue, @Query() query: unknown) {
    return {
      success: true,
      data: await this.notifications.list(principal, parseListNotifications(query)),
    };
  }

  @Patch(':notificationId')
  @Header('Cache-Control', 'no-store')
  @ApiParam({ name: 'notificationId', schema: { type: 'string', format: 'uuid' } })
  @ApiBody({ schema: patchNotificationOpenApiSchema })
  @ApiOkResponse({ schema: notificationEnvelopeOpenApiSchema })
  @ApiResponse({ status: 400, description: 'Invalid request' })
  @ApiResponse({ status: 401, description: 'Authentication required' })
  @ApiResponse({ status: 403, description: 'Access forbidden' })
  @ApiResponse({ status: 404, description: 'Resource not found' })
  async patch(
    @CurrentPrincipal() principal: CurrentPrincipalValue,
    @Param('notificationId') notificationId: string,
    @Body() body: unknown,
  ) {
    return {
      success: true,
      data: await this.notifications.patch(
        principal,
        parseNotificationId(notificationId),
        parsePatchNotification(body),
      ),
    };
  }
}
