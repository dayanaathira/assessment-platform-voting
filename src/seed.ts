import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { MikroORM, RequestContext } from '@mikro-orm/core';
import { Logger } from '@nestjs/common';
import { AppModule } from './modules/app/app.module';
import { DbSeederService } from './common/seeds/db-seeder.service';
import { validateEnv } from './config/env.validation';

/**
 * Runs the registered seeders once, as an explicit command (`npm run seed`).
 *
 * Seeding deliberately does NOT happen on boot. A service must not write rows
 * into a database as a side effect of a replica restarting — that is a
 * decision an operator makes, not something the service does on its own.
 */
async function seed(): Promise<void> {
  validateEnv();

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  try {
    const orm = app.get(MikroORM);
    await RequestContext.create(orm.em, async () => {
      await app.get(DbSeederService).runSeeder();
    });
  } catch (error) {
    Logger.error(
      'Seeding failed:',
      error instanceof Error ? error.stack : error,
    );
    process.exitCode = 1;
  } finally {
    await app.close();
  }
}

void seed();
