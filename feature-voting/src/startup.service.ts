import { MikroORM, Transaction } from '@mikro-orm/core';
import { EntityManager } from '@mikro-orm/postgresql';
import { Injectable } from '@nestjs/common';
import { SERVICE_NAME } from './app.constants';
import { WinstonLoggerService } from './common/logger/winston-logger.service';

const DEFAULT_LOCK_TIMEOUT_MS = 30_000;
const DEFAULT_LOCK_POLL_MS = 500;

/**
 * Everything that must happen once, before the service accepts traffic.
 *
 * Called from `main.ts` inside a MikroORM RequestContext. If anything here
 * throws, boot fails and the process exits — a service must never start
 * serving against a schema it could not bring up to date.
 */
@Injectable()
export class StartupService {
  constructor(
    private readonly orm: MikroORM,
    private readonly entityManager: EntityManager,
    private readonly logger: WinstonLoggerService,
  ) {}

  async initialize(): Promise<void> {
    await this.applyPendingMigrations();
  }

  /**
   * Applies committed migrations. It never generates one.
   *
   * Generating on boot means unreviewed SQL runs against whatever database
   * the container points at, and the file recording it is lost when the
   * container restarts. Worse, it makes rollback a data-loss path: redeploy
   * the previous image and the old entities diff against the new schema, so
   * the old pod generates and applies a migration undoing your change.
   *
   * An entity diff also cannot tell a rename from a drop-plus-add. Renaming
   * `fullName` to `name` generates `DROP COLUMN full_name; ADD COLUMN name;` —
   * correct-looking SQL, correct-looking result, every value in that column
   * gone. Only a human reading the file catches that, which is why generation
   * is `npm run migration:create`, a command whose output you own.
   *
   * Discovery and application both happen while holding an advisory lock. A
   * service cannot assume it runs as a single instance, and two
   * replicas starting together would otherwise both see the same pending list
   * and both apply it.
   */
  private async applyPendingMigrations(): Promise<void> {
    await this.withMigrationLock(async (transaction) => {
      // `up()` reads the applied-migrations table and applies whatever is
      // missing, both on the transaction handed in — the same session that
      // holds the lock. `getPending()` is deliberately not called first: it
      // takes no transaction argument, so it would read the applied set on a
      // second, pooled connection outside the lock.
      //
      // A replica that waited for the lock normally finds nothing to do here,
      // because the replica ahead of it has already committed.
      const appliedMigrations = await this.orm.migrator.up({ transaction });

      if (appliedMigrations.length === 0) {
        this.log('No pending migrations found.');
        return;
      }

      this.entityManager.clear();
      this.log(
        `Applied ${appliedMigrations.length} migration(s): ` +
          appliedMigrations.map((migration) => migration.name).join(', '),
      );
    });
  }

  /**
   * Runs `work` while holding a Postgres advisory lock, so that only one
   * replica migrates at a time.
   *
   * Three details matter, and getting any of them wrong makes the lock
   * decorative:
   *
   * 1. The lock is acquired *before* pending migrations are discovered and
   *    held until they have been applied. Acquiring in between is useless —
   *    both replicas would compute the same pending list, serialize on the
   *    lock, and the second would still try to re-apply what the first just
   *    did.
   *
   * 2. It waits; it does not skip. `pg_try_advisory_lock` followed by
   *    "skip if not held" is right for a bootstrap-admin style task and wrong
   *    here: the replica that skipped would go on to serve traffic against a
   *    schema nobody had finished migrating. On timeout this throws, which
   *    fails boot.
   *
   * 3. The transaction-scoped lock variant is used deliberately. Advisory
   *    locks are session-scoped, and `EntityManager` hands out pooled
   *    connections, so a lock taken on one connection and released on another
   *    leaks until the process dies. `pg_try_advisory_xact_lock` is released
   *    by the surrounding transaction no matter how this exits.
   *
   * 4. Every statement runs on the transaction, passed explicitly. This is the
   *    detail that is easiest to get wrong and impossible to see in a unit
   *    test: `connection.execute(sql, params)` does *not* inherit the
   *    surrounding `transactional()` callback. Without the `ctx` argument it
   *    takes a connection from the pool, so `pg_try_advisory_xact_lock` runs
   *    in its own implicit transaction and Postgres releases the lock the
   *    instant the statement returns — reporting `held: true` to a caller that
   *    holds nothing. The transaction is handed to `work` for the same reason.
   */
  private async withMigrationLock(
    work: (transaction: Transaction) => Promise<void>,
  ): Promise<void> {
    const lockName =
      process.env.DB_MIGRATION_LOCK_NAME?.trim() ||
      `${SERVICE_NAME}_db_migration`;
    const timeoutMs = this.readPositiveInt(
      'DB_MIGRATION_LOCK_TIMEOUT_MS',
      DEFAULT_LOCK_TIMEOUT_MS,
    );
    const pollMs = this.readPositiveInt(
      'DB_MIGRATION_LOCK_POLL_MS',
      DEFAULT_LOCK_POLL_MS,
    );

    await this.entityManager.transactional(async (transactionalEm) => {
      const transaction = transactionalEm.getTransactionContext();

      if (!transaction) {
        throw new Error(
          'No transaction context inside em.transactional(). The migration lock ' +
            'would be taken on a pooled connection and released immediately, ' +
            'leaving the migration unprotected. Refusing to start.',
        );
      }

      const deadline = Date.now() + timeoutMs;
      let waited = false;

      for (;;) {
        const result = await transactionalEm
          .getConnection()
          .execute<{ held: boolean }[]>(
            'select pg_try_advisory_xact_lock(hashtext(?)) as held',
            [lockName],
            'all',
            transaction,
          );

        if (result[0]?.held) {
          break;
        }

        if (Date.now() + pollMs > deadline) {
          throw new Error(
            `Timed out after ${timeoutMs}ms waiting for the migration lock '${lockName}'. ` +
              'Another instance is still migrating, or a previous run left a transaction open. ' +
              'Refusing to start: this instance has neither applied nor confirmed the migrations.',
          );
        }

        if (!waited) {
          waited = true;
          this.log(
            `Migration lock '${lockName}' is held by another instance. Waiting up to ${timeoutMs}ms.`,
          );
        }

        await new Promise((resolve) => setTimeout(resolve, pollMs));
      }

      if (waited) {
        this.log(`Acquired migration lock '${lockName}' after waiting.`);
      }

      await work(transaction);
    });
  }

  private readPositiveInt(variableName: string, fallback: number): number {
    const rawValue = process.env[variableName]?.trim();

    if (!rawValue) {
      return fallback;
    }

    const parsed = Number(rawValue);

    if (!Number.isInteger(parsed) || parsed <= 0) {
      throw new Error(
        `${variableName} must be a positive integer, got '${rawValue}'.`,
      );
    }

    return parsed;
  }

  private log(message: string): void {
    this.logger.getLogger().info(message, {
      label: StartupService.name + ' applyPendingMigrations',
    });
  }
}
