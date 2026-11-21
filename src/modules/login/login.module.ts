import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { LoginController } from './login.controller';
import { LoginService } from './login.service';

@Module({
  // Secrets and expiry are passed per call, so access and refresh tokens use
  // different keys.
  imports: [JwtModule.register({})],
  providers: [LoginService, { provide: APP_GUARD, useClass: JwtAuthGuard }],
  controllers: [LoginController],
})
export class LoginModule {}
