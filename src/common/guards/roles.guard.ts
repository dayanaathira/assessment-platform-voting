import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { ROLES_KEY } from '../decorators/roles.decorator';
import type { AuthUser } from '../types/auth-user.type';

/**
 * Enforces `@Roles(...)`. Runs after JwtAuthGuard, so `req.user` is set on
 * every non-public route. Routes without `@Roles` only need a valid token.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  /**
   * @param context - The current request context.
   * @returns True when no role is required or the user holds one of them.
   */
  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<string[] | undefined>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!required?.length) {
      return true;
    }

    const user = context
      .switchToHttp()
      .getRequest<Request & { user?: AuthUser }>().user;
    if (!user?.roles.some((role) => required.includes(role))) {
      throw new ForbiddenException('You do not have access to this resource');
    }

    return true;
  }
}
