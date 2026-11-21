import { Seeder } from '@mikro-orm/seeder';
import { EntityManager } from '@mikro-orm/postgresql';
import { Example } from '../../modules/example/entities/example.entity';
import { seedIfMissing } from '../utils/seed.util';

/**
 * Seeds the Example table with a couple of rows for local/dev use.
 * Insert-if-missing via seedIfMissing, keyed by id.
 */
export class ExampleSeeder extends Seeder {
  async run(entityManager: EntityManager): Promise<void> {
    await seedIfMissing(entityManager, Example, [
      { id: 1, name: 'First example' },
      { id: 2, name: 'Second example' },
    ]);
  }
}
