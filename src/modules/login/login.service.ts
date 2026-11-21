import { EntityManager, type Loaded } from '@mikro-orm/postgresql';
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

const INVALID_LOGIN = 'Invalid username or password';

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

    return this.issueTokens(user);
  }

  /**
   * Issues a new token pair. Roles are reloaded, so role changes and deleted
   * users take effect at the next refresh.
   *
   * @param refreshToken - A refresh token from login or a previous refresh.
   * @returns A new access and refresh token pair.
   */
  async refresh(refreshToken: string): Promise<TokenDto> {
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
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    const user = await this.em.findOne(User, payload.sub, {
      populate: ['userRoles.role'],
    });
    if (!user) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    return this.issueTokens(user);
  }

  /**
   * @param user - The user, with `userRoles.role` loaded.
   * @returns A signed access and refresh token pair.
   */
  private async issueTokens(
    user: Loaded<User, 'userRoles.role'>,
  ): Promise<TokenDto> {
    const access: AccessTokenPayload = {
      sub: user.id,
      name: user.name,
      roles: user.userRoles.getItems().map((ur) => ur.role.name),
    };
    const refresh: RefreshTokenPayload = { sub: user.id };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(access, {
        secret: this.config.getOrThrow<string>('JWT_SECRET'),
        expiresIn: this.config.getOrThrow<StringValue>('JWT_EXPIRES_IN'),
        algorithm: 'HS256',
      }),
      this.jwtService.signAsync(refresh, {
        secret: this.config.getOrThrow<string>('JWT_REFRESH_SECRET'),
        expiresIn: this.config.getOrThrow<StringValue>(
          'JWT_REFRESH_EXPIRES_IN',
        ),
        algorithm: 'HS256',
      }),
    ]);

    return { accessToken, refreshToken };
  }
}
