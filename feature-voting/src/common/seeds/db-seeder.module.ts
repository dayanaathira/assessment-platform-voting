import { DynamicModule, Module } from '@nestjs/common';
import { DB_SEEDERS } from '../const/seeder.const';
import { DbSeederService, SeederClass } from './db-seeder.service';

@Module({})
export class DbSeederModule {
  /**
   * @param seeders - Seeder classes to run, in order.
   * @returns The configured module.
   */
  static forRoot(seeders: SeederClass[]): DynamicModule {
    return {
      module: DbSeederModule,
      providers: [DbSeederService, { provide: DB_SEEDERS, useValue: seeders }],
      exports: [DbSeederService],
    };
  }
}
