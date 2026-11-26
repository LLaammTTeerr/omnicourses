import { applyDecorators, createParamDecorator, ExecutionContext, SetMetadata } from '@nestjs/common';
import { ApiBearerAuth, ApiUnauthorizedResponse } from '@nestjs/swagger';
import type { User } from '../users/user.entity.js';
import type { Session } from './session.entity.js';

export const IS_PUBLIC = 'isPublic';

export const Public = () => SetMetadata(IS_PUBLIC, true);

export const Authenticated = () =>
  applyDecorators(ApiBearerAuth(), ApiUnauthorizedResponse({ description: 'Missing, expired or revoked token' }));

export interface AuthenticatedRequest {
  headers: Record<string, string | string[] | undefined>;
  user?: User;
  session?: Session;
}

export const CurrentUser = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): User => ctx.switchToHttp().getRequest<AuthenticatedRequest>().user!,
);

export const CurrentSession = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): Session => ctx.switchToHttp().getRequest<AuthenticatedRequest>().session!,
);
