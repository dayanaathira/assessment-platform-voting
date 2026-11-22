import { Seeder } from '@mikro-orm/seeder';
import { EntityManager } from '@mikro-orm/postgresql';
import { Status } from '../../modules/feature-request/entities/status.entity';
import { seedIfMissing } from '../utils/seed.util';
import { STATUS_ID } from '../const/status.const';

/** Seeds the fixed feature request statuses. */
export class StatusSeeder extends Seeder {
  /**
   * @param entityManager - Entity manager to seed with.
   * @returns Resolves once the statuses are in place.
   */
  async run(entityManager: EntityManager): Promise<void> {
    await seedIfMissing(entityManager, Status, [
      { id: STATUS_ID.UNDER_REVIEW, name: 'Under Review' },
      { id: STATUS_ID.PLANNED, name: 'Planned' },
      { id: STATUS_ID.IN_PROGRESS, name: 'In Progress' },
      { id: STATUS_ID.RELEASED, name: 'Released' },
      { id: STATUS_ID.DECLINED, name: 'Declined' },
    ]);
  }
}
