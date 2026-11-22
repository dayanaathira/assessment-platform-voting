import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { ResponseMessage } from '../../common/decorators/response.decorator';
import type { AuthUser } from '../../common/types/auth-user.type';
import { CustomApiResponse } from '../../common/utils/api-response.util';
import { AuthUserDto } from './dtos/auth-user.dto';
import { LoginDto } from './dtos/login.dto';
import { RefreshTokenDto } from './dtos/refresh-token.dto';
import { TokenDto } from './dtos/token.dto';
import { LoginService } from './login.service';

@ApiTags('auth')
@Controller('auth')
export class LoginController {
  constructor(private readonly loginService: LoginService) {}

  /**
   * @param dto - Username and password.
   * @returns An access and refresh token pair.
   */
  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @CustomApiResponse(
    'Log in',
    'Returns an access token (Bearer) and a refresh token. A wrong username or password gives the same 401.',
    HttpStatus.OK,
  )
  login(@Body() dto: LoginDto): Promise<TokenDto> {
    return this.loginService.login(dto);
  }

  /**
   * @param dto - The refresh token.
   * @returns A new access and refresh token pair.
   */
  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @CustomApiResponse(
    'Refresh tokens',
    'Exchanges a valid refresh token for a new pair, with roles reloaded. The token sent is revoked, so each refresh token works once.',
    HttpStatus.OK,
  )
  refresh(@Body() dto: RefreshTokenDto): Promise<TokenDto> {
    return this.loginService.refresh(dto.refreshToken);
  }

  /**
   * @param dto - The refresh token to revoke.
   * @returns Resolves once revoked.
   */
  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Logged out')
  @CustomApiResponse(
    'Log out',
    'Revokes the refresh token. Always returns 200, even for an invalid or already revoked token. The access token stays valid until it expires.',
    HttpStatus.OK,
  )
  logout(@Body() dto: RefreshTokenDto): Promise<void> {
    return this.loginService.logout(dto.refreshToken);
  }

  /**
   * @param user - The signed-in user.
   * @returns The user's id, name and roles from the access token.
   */
  @ApiBearerAuth()
  @Get('me')
  @CustomApiResponse(
    'Current user',
    'Returns the id, name and roles in the access token.',
    HttpStatus.OK,
  )
  me(@CurrentUser() user: AuthUser): AuthUserDto {
    return user;
  }
}
