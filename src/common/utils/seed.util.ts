import type { RequiredEntityData } from '@mikro-orm/core';
import { EntityManager } from '@mikro-orm/postgresql';

/**
 * Inserts the rows whose id isn't in the table yet, in one
 * `INSERT ... ON CONFLICT (id) DO NOTHING`. Existing rows are left untouched,
 * so seeders stay idempotent.
 *
 * @param entityManager - Entity manager to seed with.
 * @param entityClass - Entity to seed.
 * @param rows - Rows to insert, each with its fixed id.
 * @returns Resolves once the insert has run.
 */
export async function seedIfMissing<T extends { id: number }>(
  entityManager: EntityManager,
  entityClass: new () => T,
  rows: RequiredEntityData<T>[],
): Promise<void> {
  if (rows.length === 0) {
    return;
  }

  await entityManager
    .createQueryBuilder(entityClass)
    .insert(rows)
    .onConflict('id')
    .ignore()
    .execute();
}
