import { Controller, Get, Header, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiResponse, ApiTags } from '@nestjs/swagger';

import { AccessTokenGuard } from '../authorization/access-token.guard.js';
import {
  CurrentPrincipal,
  type CurrentPrincipalValue,
} from '../authorization/current-principal.js';
import { AppError } from '../common/errors/app-error.js';

const capabilityEnvelopeSchema = {
  type: 'object' as const,
  additionalProperties: false,
  required: ['success', 'data'],
  properties: {
    success: { type: 'boolean' as const, enum: [true] },
    data: {
      type: 'object' as const,
      additionalProperties: false,
      required: ['status', 'reasonCode'],
      properties: {
        status: { type: 'string' as const, enum: ['NOT_AVAILABLE'] },
        reasonCode: { type: 'string' as const, enum: ['DEVICE_CONTRACT_PENDING'] },
      },
    },
  },
};

@ApiTags('device-configurations')
@ApiBearerAuth()
@UseGuards(AccessTokenGuard)
@Controller('device-configurations')
export class DeviceConfigurationCapabilityController {
  @Get('capability')
  @Header('Cache-Control', 'no-store')
  @ApiOkResponse({ schema: capabilityEnvelopeSchema })
  @ApiResponse({ status: 401, description: 'Authentication required' })
  @ApiResponse({ status: 403, description: 'Access forbidden' })
  capability(@CurrentPrincipal() principal: CurrentPrincipalValue) {
    if (principal.status !== 'ACTIVE' || !['ADMIN', 'FARMER'].includes(principal.role)) {
      throw new AppError('FORBIDDEN', 403, 'Access is forbidden');
    }
    return {
      success: true,
      data: { status: 'NOT_AVAILABLE' as const, reasonCode: 'DEVICE_CONTRACT_PENDING' as const },
    };
  }
}
