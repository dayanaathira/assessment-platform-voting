import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { JwtAuthGuard } from './jwt-auth.guard';
import type { AuthUser } from '../types/auth-user.type';

const ACCESS_SECRET = 'access-secret-for-tests-0123456789abcdef';
const REFRESH_SECRET = 'refresh-secret-for-tests-0123456789abcdef';

describe('JwtAuthGuard', () => {
  const reflector = new Reflector();
  const jwt = new JwtService();
  const config = {
    getOrThrow: () => ACCESS_SECRET,
  } as unknown as ConfigService;
  const guard = new JwtAuthGuard(reflector, jwt, config);

  /**
   * @param authorization - The Authorization header, if any.
   * @returns The request and a context wrapping it.
   */
  function contextFor(authorization?: string) {
    const request: { headers: { authorization?: string }; user?: AuthUser } = {
      headers: { authorization },
    };
    const context = {
      getHandler: () => undefined,
      getClass: () => undefined,
      switchToHttp: () => ({ getRequest: () => request }),
    } as unknown as ExecutionContext;
    return { request, context };
  }

  /**
   * @param secret - Signing secret.
   * @returns A token for a user holding both roles.
   */
  function sign(secret: string): Promise<string> {
    return jwt.signAsync(
      { sub: 'u1', name: 'User 1', roles: ['user', 'admin'] },
      { secret, expiresIn: '5m' },
    );
  }

  beforeEach(() => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);
  });

  afterEach(() => jest.restoreAllMocks());

  it('lets public routes through without a token', async () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(true);

    await expect(guard.canActivate(contextFor().context)).resolves.toBe(true);
  });

  it('sets req.user from a valid access token', async () => {
    const { request, context } = contextFor(
      `Bearer ${await sign(ACCESS_SECRET)}`,
    );

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(request.user).toEqual({
      id: 'u1',
      name: 'User 1',
      roles: ['user', 'admin'],
    });
  });

  it.each([
    ['no header', undefined],
    ['a non-Bearer scheme', 'Basic dXNlcjpwYXNz'],
    ['an empty Bearer token', 'Bearer '],
    ['a malformed token', 'Bearer not.a.jwt'],
  ])('rejects %s', async (_label, header) => {
    await expect(guard.canActivate(contextFor(header).context)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  // A refresh token is signed with a different secret, so it can't be used to
  // call the API.
  it('rejects a refresh token used as an access token', async () => {
    const { context } = contextFor(`Bearer ${await sign(REFRESH_SECRET)}`);

    await expect(guard.canActivate(context)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('rejects a token whose payload was edited', async () => {
    const [header, , signature] = (await sign(ACCESS_SECRET)).split('.');
    const forged = Buffer.from(
      JSON.stringify({ sub: 'u2', name: 'x', roles: ['admin'] }),
    ).toString('base64url');
    const { context } = contextFor(`Bearer ${header}.${forged}.${signature}`);

    await expect(guard.canActivate(context)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('rejects an expired token', async () => {
    const expired = await jwt.signAsync(
      {
        sub: 'u1',
        name: 'n',
        roles: [],
        exp: Math.floor(Date.now() / 1000) - 60,
      },
      { secret: ACCESS_SECRET },
    );

    await expect(
      guard.canActivate(contextFor(`Bearer ${expired}`).context),
    ).rejects.toThrow(UnauthorizedException);
  });
});
