import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { EntityManager } from '@mikro-orm/postgresql';
import { hashPassword } from '../../common/utils/password.util';
import { LoginService } from './login.service';

const CONFIG: Record<string, string> = {
  JWT_SECRET: 'access-secret-for-tests-0123456789abcdef',
  JWT_EXPIRES_IN: '15m',
  JWT_REFRESH_SECRET: 'refresh-secret-for-tests-0123456789abcdef',
  JWT_REFRESH_EXPIRES_IN: '7d',
};
const PASSWORD = 'correct-horse-9';

describe('LoginService', () => {
  const jwt = new JwtService();
  let passwordHash: string;
  let findOne: jest.Mock;
  let service: LoginService;

  beforeAll(async () => {
    passwordHash = await hashPassword(PASSWORD);
  });

  beforeEach(() => {
    findOne = jest.fn();
    service = new LoginService({ findOne } as unknown as EntityManager, jwt, {
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

  it('returns an access token carrying every role, and a refresh token', async () => {
    findOne.mockResolvedValue(aUser(['user', 'admin']));

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

  // Same error for both, so the response doesn't reveal which usernames exist.
  it.each([
    ['a wrong password', () => aUser(['user']), 'wrong-password'],
    ['an unknown username', () => null, PASSWORD],
  ])('rejects %s with the same message', async (_label, user, password) => {
    findOne.mockResolvedValue(user());

    await expect(
      service.login({ username: 'user1', password }),
    ).rejects.toThrow(
      new UnauthorizedException('Invalid username or password'),
    );
  });

  it('issues a new pair from a valid refresh token, reloading roles', async () => {
    findOne.mockResolvedValue(aUser(['user']));
    const { refreshToken } = await service.login({
      username: 'user1',
      password: PASSWORD,
    });
    findOne.mockResolvedValue(aUser(['user', 'admin']));

    const { accessToken } = await service.refresh(refreshToken);

    await expect(
      jwt.verifyAsync(accessToken, { secret: CONFIG.JWT_SECRET }),
    ).resolves.toMatchObject({ roles: ['user', 'admin'] });
  });

  it('rejects an access token used as a refresh token', async () => {
    findOne.mockResolvedValue(aUser(['user']));
    const { accessToken } = await service.login({
      username: 'user1',
      password: PASSWORD,
    });

    await expect(service.refresh(accessToken)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('rejects a refresh token for a user that no longer exists', async () => {
    findOne.mockResolvedValue(aUser(['user']));
    const { refreshToken } = await service.login({
      username: 'user1',
      password: PASSWORD,
    });
    findOne.mockResolvedValue(null);

    await expect(service.refresh(refreshToken)).rejects.toThrow(
      UnauthorizedException,
    );
  });
});
