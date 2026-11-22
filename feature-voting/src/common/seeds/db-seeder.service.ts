import { Seeder } from '@mikro-orm/seeder';
import { Inject, Injectable } from '@nestjs/common';
import { EntityManager, MikroORM } from '@mikro-orm/postgresql';
import { DB_SEEDERS } from '../const/seeder.const';
import { WinstonLoggerService } from '../logger/winston-logger.service';

/** Constructor of a seeder to run, as passed to `DbSeederModule.forRoot()`. */
export type SeederClass = new () => Seeder;

@Injectable()
export class DbSeederService extends Seeder {
  constructor(
    private readonly orm: MikroORM,
    private readonly logger: WinstonLoggerService,
    @Inject(DB_SEEDERS) private readonly seeders: SeederClass[],
  ) {
    super();
  }

  /**
   * Runs the registered seeders in order; MikroORM flushes after each.
   *
   * @param entityManager - Entity manager to seed with.
   * @returns Resolves when every seeder has run.
   */
  async run(entityManager: EntityManager): Promise<void> {
    return this.call(entityManager, this.seeders);
  }

  /**
   * Entry point for `npm run seed`.
   *
   * @returns Resolves when seeding is complete; rethrows on failure.
   */
  async runSeeder(): Promise<void> {
    const label = DbSeederService.name + ' runSeeder';

    try {
      this.logger.getLogger().info('Seeding init...', { label });
      await this.run(this.orm.em as EntityManager);
      this.logger.getLogger().info('Seeding completed.', { label });
    } catch (error) {
      this.logger.getLogger().error('Error running seeders', {
        label,
        stack: error instanceof Error ? error.stack : String(error),
      });
      throw error;
    }
  }
}
