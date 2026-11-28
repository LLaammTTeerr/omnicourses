import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ACCEPTS_PREVIOUS_TOKEN, AuthenticatedRequest, IS_PUBLIC } from './auth.decorators.js';
import { AuthService } from './auth.service.js';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly auth: AuthService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const targets = [context.getHandler(), context.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, targets)) return true;

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const acceptsPrevious = this.reflector.getAllAndOverride<boolean>(ACCEPTS_PREVIOUS_TOKEN, targets) ?? false;
    const found = await this.auth.authenticateHeader(request.headers.authorization, acceptsPrevious);
    if (!found) throw new UnauthorizedException();

    request.user = found.user;
    request.session = found.session;
    return true;
  }
}
