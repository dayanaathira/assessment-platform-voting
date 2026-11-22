import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from './roles.guard';
import type { AuthUser } from '../types/auth-user.type';

/**
 * @param user - The user on the request, if any.
 * @returns A context whose handler and class carry no metadata of their own.
 */
function contextFor(user?: AuthUser): ExecutionContext {
  return {
    getHandler: () => undefined,
    getClass: () => undefined,
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  } as unknown as ExecutionContext;
}

describe('RolesGuard', () => {
  const reflector = new Reflector();
  const guard = new RolesGuard(reflector);
  const user = (roles: string[]): AuthUser => ({ id: 'u1', name: 'n', roles });

  afterEach(() => jest.restoreAllMocks());

  it('allows any signed-in user when no role is required', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);

    expect(guard.canActivate(contextFor(user([])))).toBe(true);
  });

  it('allows a user holding the required role', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['admin']);

    expect(guard.canActivate(contextFor(user(['admin'])))).toBe(true);
  });

  it('allows a user with several roles when one matches', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['admin']);

    expect(guard.canActivate(contextFor(user(['user', 'admin'])))).toBe(true);
  });

  it.each([[['user']], [[]]])(
    'rejects a user with roles %j from an admin route',
    (roles) => {
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['admin']);

      expect(() => guard.canActivate(contextFor(user(roles)))).toThrow(
        ForbiddenException,
      );
    },
  );

  it('rejects a request with no user on a role-protected route', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['admin']);

    expect(() => guard.canActivate(contextFor())).toThrow(ForbiddenException);
  });
});
