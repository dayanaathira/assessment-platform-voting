import type { RequiredEntityData } from '@mikro-orm/core';
import { EntityManager } from '@mikro-orm/postgresql';

/**
 * Inserts the rows that aren't in the table yet, in one
 * `INSERT ... ON CONFLICT (<conflictOn>) DO NOTHING`. Existing rows are left
 * untouched, so seeders stay idempotent.
 *
 * @param entityManager - Entity manager to seed with.
 * @param entityClass - Entity to seed.
 * @param rows - Rows to insert.
 * @param conflictOn - Unique property that identifies an existing row.
 * @returns Resolves once the insert has run.
 */
export async function seedIfMissing<T extends { id: number | string }>(
  entityManager: EntityManager,
  entityClass: new () => T,
  rows: RequiredEntityData<T>[],
  conflictOn: keyof T & string = 'id',
): Promise<void> {
  if (rows.length === 0) {
    return;
  }

  await entityManager
    .createQueryBuilder(entityClass)
    .insert(rows)
    .onConflict(conflictOn)
    .ignore()
    .execute();
}
