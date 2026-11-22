import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { EntityManager, LockMode } from '@mikro-orm/postgresql';
import { hashPassword } from '../../common/utils/password.util';
import { User } from '../user/entities/user.entity';
import { RefreshToken } from './entities/refresh-token.entity';
import { LoginService } from './login.service';

const CONFIG: Record<string, string> = {
  JWT_SECRET: 'access-secret-for-tests-0123456789abcdef',
  JWT_EXPIRES_IN: '15m',
  JWT_REFRESH_SECRET: 'refresh-secret-for-tests-0123456789abcdef',
  JWT_REFRESH_EXPIRES_IN: '7d',
};
const PASSWORD = 'correct-horse-9';

interface StoredToken {
  id: string;
  user: unknown;
  expiresAt: Date;
  revokedAt?: Date | null;
}

describe('LoginService', () => {
  const jwt = new JwtService();
  let passwordHash: string;
  let user: ReturnType<typeof aUser> | null;
  // Stands in for the refresh_token table, keyed by jti.
  let tokens: Map<string, StoredToken>;
  let em: Record<string, jest.Mock>;
  let service: LoginService;

  beforeAll(async () => {
    passwordHash = await hashPassword(PASSWORD);
  });

  beforeEach(() => {
    user = aUser(['user']);
    tokens = new Map();
    em = {
      findOne: jest.fn((entity: unknown, where: { id?: string } | string) =>
        Promise.resolve(
          entity === RefreshToken
            ? (tokens.get((where as { id: string }).id) ?? null)
            : user,
        ),
      ),
      create: jest.fn((_entity: unknown, data: StoredToken) => {
        tokens.set(data.id, { ...data, revokedAt: null });
      }),
      flush: jest.fn(),
      nativeDelete: jest.fn(),
      nativeUpdate: jest.fn(
        (_entity: unknown, where: { id: string }, data: StoredToken) => {
          const row = tokens.get(where.id);
          if (row && !row.revokedAt) {
            row.revokedAt = data.revokedAt;
          }
        },
      ),
      transactional: jest.fn((work: (tx: unknown) => unknown) => work(em)),
    };
    service = new LoginService(em as unknown as EntityManager, jwt, {
      getOrThrow: (key: string) => CONFIG[key],
    } as unknown as ConfigService);
  });

  /**
   * @param roles - Role names the user holds.
   * @returns A loaded user with those roles.
   */
  function aUser(roles: string[]) {
    return {
      id: 'u1',
      name: 'User 1',
      passwordHash,
      userRoles: { getItems: () => roles.map((name) => ({ role: { name } })) },
    };
  }

  /**
   * @returns The refresh token from a successful login.
   */
  async function loginRefreshToken(): Promise<string> {
    const { refreshToken } = await service.login({
      username: 'user1',
      password: PASSWORD,
    });
    return refreshToken;
  }

  /**
   * @param token - A refresh token.
   * @returns Its jti claim.
   */
  function jtiOf(token: string): string {
    return jwt.decode<{ jti: string }>(token).jti;
  }

  it('returns an access token carrying every role, and a refresh token', async () => {
    user = aUser(['user', 'admin']);

    const { accessToken, refreshToken } = await service.login({
      username: 'user1',
      password: PASSWORD,
    });

    await expect(
      jwt.verifyAsync(accessToken, { secret: CONFIG.JWT_SECRET }),
    ).resolves.toMatchObject({
      sub: 'u1',
      name: 'User 1',
      roles: ['user', 'admin'],
    });
    await expect(
      jwt.verifyAsync(refreshToken, { secret: CONFIG.JWT_REFRESH_SECRET }),
    ).resolves.toMatchObject({ sub: 'u1' });
  });

  it('records the refresh token by jti with the token expiry, and clears expired rows', async () => {
    const refreshToken = await loginRefreshToken();
    const { jti, exp } = jwt.decode<{ jti: string; exp: number }>(refreshToken);

    expect(tokens.get(jti)).toMatchObject({
      expiresAt: new Date(exp * 1000),
      revokedAt: null,
    });
    expect(em.nativeDelete).toHaveBeenCalledWith(RefreshToken, {
      user: 'u1',
      expiresAt: { $lt: expect.any(Date) },
    });
  });

  // Same error for both, so the response doesn't reveal which usernames exist.
  it.each([
    ['a wrong password', () => aUser(['user']), 'wrong-password'],
    ['an unknown username', () => null, PASSWORD],
  ])('rejects %s with the same message', async (_label, found, password) => {
    user = found();

    await expect(
      service.login({ username: 'user1', password }),
    ).rejects.toThrow(
      new UnauthorizedException('Invalid username or password'),
    );
    expect(tokens.size).toBe(0);
  });

  it('rotates: revokes the token used and records a new one, reloading roles', async () => {
    const oldToken = await loginRefreshToken();
    user = aUser(['user', 'admin']);

    const { accessToken, refreshToken } = await service.refresh(oldToken);

    expect(tokens.get(jtiOf(oldToken))?.revokedAt).toBeInstanceOf(Date);
    expect(jtiOf(refreshToken)).not.toBe(jtiOf(oldToken));
    expect(tokens.get(jtiOf(refreshToken))?.revokedAt).toBeNull();
    await expect(
      jwt.verifyAsync(accessToken, { secret: CONFIG.JWT_SECRET }),
    ).resolves.toMatchObject({ roles: ['user', 'admin'] });
  });

  it('locks the token row so concurrent refreshes queue up', async () => {
    const refreshToken = await loginRefreshToken();

    await service.refresh(refreshToken);

    expect(em.findOne).toHaveBeenCalledWith(
      RefreshToken,
      { id: jtiOf(refreshToken), user: 'u1' },
      { lockMode: LockMode.PESSIMISTIC_WRITE },
    );
  });

  it('rejects a refresh token that was already used', async () => {
    const refreshToken = await loginRefreshToken();
    await service.refresh(refreshToken);

    await expect(service.refresh(refreshToken)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('rejects a refresh token with no stored row', async () => {
    const refreshToken = await loginRefreshToken();
    tokens.clear();

    await expect(service.refresh(refreshToken)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('rejects a refresh token issued before rotation (no jti)', async () => {
    const legacy = await jwt.signAsync(
      { sub: 'u1' },
      { secret: CONFIG.JWT_REFRESH_SECRET, expiresIn: '7d' },
    );

    await expect(service.refresh(legacy)).rejects.toThrow(
      UnauthorizedException,
    );
    expect(em.transactional).not.toHaveBeenCalled();
  });

  it('rejects an access token used as a refresh token', async () => {
    const { accessToken } = await service.login({
      username: 'user1',
      password: PASSWORD,
    });

    await expect(service.refresh(accessToken)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('rejects a refresh token for a user that no longer exists', async () => {
    const refreshToken = await loginRefreshToken();
    user = null;

    await expect(service.refresh(refreshToken)).rejects.toThrow(
      UnauthorizedException,
    );
    expect(em.findOne).toHaveBeenCalledWith(User, 'u1', expect.anything());
  });

  it('revokes the refresh token on logout, so it no longer refreshes', async () => {
    const refreshToken = await loginRefreshToken();

    await service.logout(refreshToken);

    expect(tokens.get(jtiOf(refreshToken))?.revokedAt).toBeInstanceOf(Date);
    await expect(service.refresh(refreshToken)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it.each([
    ['a malformed token', () => Promise.resolve('not-a-jwt')],
    [
      'a token from before rotation (no jti)',
      () =>
        jwt.signAsync(
          { sub: 'u1' },
          { secret: CONFIG.JWT_REFRESH_SECRET, expiresIn: '7d' },
        ),
    ],
  ])('ignores logout with %s and writes nothing', async (_label, token) => {
    await expect(service.logout(await token())).resolves.toBeUndefined();
    expect(em.nativeUpdate).not.toHaveBeenCalled();
  });
});
