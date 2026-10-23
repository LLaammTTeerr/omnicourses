import { createParamDecorator, ExecutionContext, SetMetadata } from '@nestjs/common';
import type { User } from '../users/user.entity.js';
import type { Session } from './session.entity.js';

export const IS_PUBLIC = 'isPublic';

/** Opts a route (or a whole controller) out of the global AuthGuard. */
export const Public = () => SetMetadata(IS_PUBLIC, true);

export interface AuthenticatedRequest {
  headers: Record<string, string | string[] | undefined>;
  user?: User;
  session?: Session;
}

/** The signed-in user. Only valid on routes that are not @Public(). */
export const CurrentUser = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): User => ctx.switchToHttp().getRequest<AuthenticatedRequest>().user!,
);

/** The session the request was authenticated with. */
export const CurrentSession = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): Session => ctx.switchToHttp().getRequest<AuthenticatedRequest>().session!,
);
