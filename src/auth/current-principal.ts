import { createParamDecorator, type ExecutionContext } from '@nestjs/common';

export type CurrentPrincipalValue = Readonly<{
  userId: string;
  role: 'ADMIN';
  isSuperAdmin: boolean;
}>;

type RequestWithPrincipal = { principal?: CurrentPrincipalValue };

export const CurrentPrincipal = createParamDecorator(
  (_data: unknown, context: ExecutionContext): CurrentPrincipalValue => {
    const request = context.switchToHttp().getRequest<RequestWithPrincipal>();
    if (!request.principal) {
      throw new Error('Authenticated principal was not attached to the request');
    }
    return request.principal;
  },
);
