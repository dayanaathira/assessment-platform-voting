import { randomUUID } from 'node:crypto';
import { Seeder } from '@mikro-orm/seeder';
import { EntityManager } from '@mikro-orm/postgresql';
import { Role } from '../../modules/user/entities/role.entity';
import { seedIfMissing } from '../utils/seed.util';
import { ROLE } from '../../modules/user/user.const';

/** Seeds the admin and user roles, skipping any that already exist by name. */
export class RoleSeeder extends Seeder {
  /**
   * @param entityManager - Entity manager to seed with.
   * @returns Resolves once the roles are in place.
   */
  async run(entityManager: EntityManager): Promise<void> {
    await seedIfMissing(
      entityManager,
      Role,
      [
        { id: randomUUID(), name: ROLE.ADMIN },
        { id: randomUUID(), name: ROLE.USER },
      ],
      'name',
    );
  }
}
