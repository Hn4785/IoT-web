import { createParamDecorator, type ExecutionContext, SetMetadata } from '@nestjs/common';

import type { UserRole, UserStatus } from '../generated/prisma/enums.js';

export const ALLOW_PENDING_PASSWORD_CHANGE = Symbol('ALLOW_PENDING_PASSWORD_CHANGE');
export const AllowPendingPasswordChange = () =>
  SetMetadata(ALLOW_PENDING_PASSWORD_CHANGE, true);

export type CurrentPrincipalValue = Readonly<{
  userId: string;
  sessionId: string;
  role: UserRole;
  status: UserStatus;
  isSuperAdmin: boolean;
}>;

export type RequestWithPrincipal = {
  headers: { authorization?: string };
  principal?: CurrentPrincipalValue;
};

export const CurrentPrincipal = createParamDecorator(
  (_data: unknown, context: ExecutionContext): CurrentPrincipalValue => {
    const request = context.switchToHttp().getRequest<RequestWithPrincipal>();
    if (!request.principal) {
      throw new Error('Authenticated principal was not attached to the request');
    }
    return request.principal;
  },
);
