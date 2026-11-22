import { randomUUID } from 'node:crypto';
import { EntityManager, LockMode, type Loaded } from '@mikro-orm/postgresql';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { StringValue } from 'ms';
import { hashPassword, verifyPassword } from '../../common/utils/password.util';
import type {
  AccessTokenPayload,
  RefreshTokenPayload,
} from '../../common/types/auth-user.type';
import { User } from '../user/entities/user.entity';
import { LoginDto } from './dtos/login.dto';
import { TokenDto } from './dtos/token.dto';
import { RefreshToken } from './entities/refresh-token.entity';

const INVALID_LOGIN = 'Invalid username or password';
const INVALID_REFRESH = 'Invalid or expired refresh token';

@Injectable()
export class LoginService {
  // Compared against when the username doesn't exist, so a miss takes as long
  // as a wrong password and doesn't reveal which usernames are real.
  private readonly dummyHash = hashPassword('not-a-real-password');

  constructor(
    private readonly em: EntityManager,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
  ) {}

  /**
   * @param dto - Username and password.
   * @returns A new access and refresh token pair.
   */
  async login(dto: LoginDto): Promise<TokenDto> {
    const user = await this.em.findOne(
      User,
      { username: dto.username },
      { populate: ['userRoles.role'] },
    );

    const valid = await verifyPassword(
      dto.password,
      user?.passwordHash ?? (await this.dummyHash),
    );
    if (!user || !valid) {
      throw new UnauthorizedException(INVALID_LOGIN);
    }

    // Housekeeping: the user's expired rows can't be used any more.
    await this.em.nativeDelete(RefreshToken, {
      user: user.id,
      expiresAt: { $lt: new Date() },
    });

    return this.issueTokens(this.em, user);
  }

  /**
   * Rotates the refresh token: the one presented is revoked and a new pair is
   * issued, so each refresh token works once. The row is locked so two
   * concurrent refreshes with the same token can't both succeed. Roles are
   * reloaded, so role changes and deleted users take effect here.
   *
   * @param refreshToken - A refresh token from login or a previous refresh.
   * @returns A new access and refresh token pair.
   */
  async refresh(refreshToken: string): Promise<TokenDto> {
    const claims = await this.verifyRefreshToken(refreshToken);
    if (!claims) {
      throw new UnauthorizedException(INVALID_REFRESH);
    }
    const { sub, jti } = claims;

    return this.em.transactional(async (em) => {
      const stored = await em.findOne(
        RefreshToken,
        { id: jti, user: sub },
        { lockMode: LockMode.PESSIMISTIC_WRITE },
      );
      if (!stored || stored.revokedAt) {
        throw new UnauthorizedException(INVALID_REFRESH);
      }

      const user = await em.findOne(User, sub, {
        populate: ['userRoles.role'],
      });
      if (!user) {
        throw new UnauthorizedException(INVALID_REFRESH);
      }

      stored.revokedAt = new Date();
      return this.issueTokens(em, user);
    });
  }

  /**
   * Revokes the refresh token so it can't be used again. Access tokens stay
   * valid until they expire (15 minutes by default). Like OAuth token
   * revocation (RFC 7009), an invalid, expired or already revoked token is a
   * silent no-op: the goal is already met, and the response doesn't reveal
   * whether a token was still live.
   *
   * @param refreshToken - The refresh token to revoke.
   * @returns Resolves once done.
   */
  async logout(refreshToken: string): Promise<void> {
    const claims = await this.verifyRefreshToken(refreshToken);
    if (!claims) {
      return;
    }

    await this.em.nativeUpdate(
      RefreshToken,
      { id: claims.jti, user: claims.sub, revokedAt: null },
      { revokedAt: new Date() },
    );
  }

  /**
   * @param refreshToken - The token to check.
   * @returns Its claims with the jti, or null when the token is invalid,
   *   expired, or from before rotation (no jti).
   */
  private async verifyRefreshToken(
    refreshToken: string,
  ): Promise<Required<RefreshTokenPayload> | null> {
    let payload: RefreshTokenPayload;
    try {
      payload = await this.jwtService.verifyAsync<RefreshTokenPayload>(
        refreshToken,
        {
          secret: this.config.getOrThrow<string>('JWT_REFRESH_SECRET'),
          algorithms: ['HS256'],
        },
      );
    } catch {
      return null;
    }

    return payload.jti ? { sub: payload.sub, jti: payload.jti } : null;
  }

  /**
   * Signs a token pair and records the refresh token's jti.
   *
   * @param em - The entity manager to record the refresh token with.
   * @param user - The user, with `userRoles.role` loaded.
   * @returns A signed access and refresh token pair.
   */
  private async issueTokens(
    em: EntityManager,
    user: Loaded<User, 'userRoles.role'>,
  ): Promise<TokenDto> {
    const access: AccessTokenPayload = {
      sub: user.id,
      name: user.name,
      roles: user.userRoles.getItems().map((ur) => ur.role.name),
    };
    const jti = randomUUID();

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(access, {
        secret: this.config.getOrThrow<string>('JWT_SECRET'),
        expiresIn: this.config.getOrThrow<StringValue>('JWT_EXPIRES_IN'),
        algorithm: 'HS256',
      }),
      this.jwtService.signAsync(
        { sub: user.id } satisfies RefreshTokenPayload,
        {
          secret: this.config.getOrThrow<string>('JWT_REFRESH_SECRET'),
          expiresIn: this.config.getOrThrow<StringValue>(
            'JWT_REFRESH_EXPIRES_IN',
          ),
          algorithm: 'HS256',
          jwtid: jti,
        },
      ),
    ]);

    // Expiry comes from the signed token, so the duration lives in one place.
    const { exp } = this.jwtService.decode<{ exp: number }>(refreshToken);
    em.create(RefreshToken, {
      id: jti,
      user,
      expiresAt: new Date(exp * 1000),
    });
    await em.flush();

    return { accessToken, refreshToken };
  }
}
