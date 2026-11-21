import { randomUUID } from 'node:crypto';
import { Seeder } from '@mikro-orm/seeder';
import { EntityManager } from '@mikro-orm/postgresql';
import { Role } from '../../modules/user/entities/role.entity';
import { UserRole } from '../../modules/user/entities/user-role.entity';
import { User } from '../../modules/user/entities/user.entity';
import { ROLE, type RoleName } from '../../modules/user/user.const';
import { hashPassword } from '../utils/password.util';
import { seedIfMissing } from '../utils/seed.util';

const SEED_USERS: { username: string; name: string; role: RoleName }[] = [
  { username: 'admin', name: 'Admin', role: ROLE.ADMIN },
  { username: 'user1', name: 'User 1', role: ROLE.USER },
  { username: 'user2', name: 'User 2', role: ROLE.USER },
  { username: 'user3', name: 'User 3', role: ROLE.USER },
];

/**
 * Seeds one admin and three users. Passwords come from SEED_ADMIN_PASSWORD and
 * SEED_USER_PASSWORD, so no credentials live in the repo. Existing users are
 * left untouched, and only missing ones are hashed.
 */
export class UserSeeder extends Seeder {
  /**
   * @param entityManager - Entity manager to seed with.
   * @returns Resolves once the users and their roles are in place.
   */
  async run(entityManager: EntityManager): Promise<void> {
    const adminPassword = process.env.SEED_ADMIN_PASSWORD;
    const userPassword = process.env.SEED_USER_PASSWORD;
    if (!adminPassword || !userPassword) {
      throw new Error(
        'Set SEED_ADMIN_PASSWORD and SEED_USER_PASSWORD in .env to seed users',
      );
    }
    const passwords: Record<RoleName, string> = {
      [ROLE.ADMIN]: adminPassword,
      [ROLE.USER]: userPassword,
    };

    const usernames = SEED_USERS.map((u) => u.username);
    const existing = await entityManager.find(
      User,
      { username: { $in: usernames } },
      { fields: ['username'] },
    );
    const existingNames = new Set(existing.map((u) => u.username));

    const newUsers = await Promise.all(
      SEED_USERS.filter((u) => !existingNames.has(u.username)).map(
        async (u) => ({
          id: randomUUID(),
          name: u.name,
          username: u.username,
          passwordHash: await hashPassword(passwords[u.role]),
        }),
      ),
    );
    await seedIfMissing(entityManager, User, newUsers, 'username');

    const [users, roles] = await Promise.all([
      entityManager.find(
        User,
        { username: { $in: usernames } },
        { fields: ['id', 'username'] },
      ),
      entityManager.find(Role, {
        name: { $in: Object.values(ROLE) },
      }),
    ]);
    const roleIds = new Map(roles.map((r) => [r.name, r.id]));
    const userIds = new Map(users.map((u) => [u.username, u.id]));

    const userRoles = SEED_USERS.map((u) => {
      const user = userIds.get(u.username);
      const role = roleIds.get(u.role);
      if (!user || !role) {
        throw new Error(`Cannot link ${u.username} to role ${u.role}`);
      }
      return { id: randomUUID(), user, role };
    });
    await seedIfMissing(entityManager, UserRole, userRoles, ['user', 'role']);
  }
}
