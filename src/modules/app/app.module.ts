import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule } from '@nestjs/config';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import config from '../../.././mikro-orm.config';
import { AllExceptionsFilter } from '../../common/filters/all-exceptions.filter';
import { WinstonLoggerModule } from '../../common/logger/winston-logger.module';
import { DbSeederModule } from '../../common/seeds/db-seeder.module';
import { SERVICE_NAME } from '../../app.constants';
import { validateEnv } from '../../config/env.validation';
import { StartupService } from '../../startup.service';
import { HealthModule } from '../health/health.module';
import { FeatureRequestModule } from '../feature-request/feature-request.module';
import { AdminModule } from '../admin/admin.module';
import { ReportingModule } from '../reporting/reporting.module';
import { UserModule } from '../user/user.module';
import { LoginModule } from '../login/login.module';
import { StatusSeeder } from '../../common/seeds/status.seeder';
import { RoleSeeder } from '../../common/seeds/role.seeder';
import { UserSeeder } from '../../common/seeds/user.seeder';

@Module({
  imports: [
    MikroOrmModule.forRoot(config),
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnv,
    }),
    WinstonLoggerModule.forRoot(SERVICE_NAME),
    DbSeederModule.forRoot([StatusSeeder, RoleSeeder, UserSeeder]),
    HealthModule,
    FeatureRequestModule,
    AdminModule,
    ReportingModule,
    UserModule,
    LoginModule,
  ],
  controllers: [AppController],
  providers: [AppService, StartupService, AllExceptionsFilter],
})
export class AppModule {}
