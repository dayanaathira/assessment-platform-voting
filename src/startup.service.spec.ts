import { MikroORM } from '@mikro-orm/core';
import { EntityManager } from '@mikro-orm/postgresql';
import { StartupService } from './startup.service';
import { WinstonLoggerService } from './common/logger/winston-logger.service';

/**
 * Stands in for the transaction handle `em.transactional()` hands out. The
 * tests only ever check identity — that this exact object reaches both the
 * lock statement and the migrator — so it needs no behaviour.
 */
const TRANSACTION = { id: 'transaction-handle' };

describe('StartupService', () => {
  let migrator: { getPending: jest.Mock; up: jest.Mock; create: jest.Mock };
  let execute: jest.Mock;
  let entityManager: { clear: jest.Mock; transactional: jest.Mock };
  let startupService: StartupService;

  /** Makes the advisory lock report "held" on the nth attempt (1 = first). */
  const grantLockOnAttempt = (attempt: number) => {
    let attempts = 0;
    execute.mockImplementation(() => {
      attempts += 1;
      return Promise.resolve([{ held: attempts >= attempt }]);
    });
  };

  /** Replaces the transactional EM, so a missing context can be simulated. */
  const withTransactionContext = (transaction: unknown) => {
    entityManager.transactional.mockImplementation((callback) =>
      callback({
        getConnection: () => ({ execute }),
        getTransactionContext: () => transaction,
      }),
    );
  };

  beforeEach(() => {
    migrator = {
      getPending: jest.fn().mockResolvedValue([]),
      up: jest.fn().mockResolvedValue([]),
      create: jest.fn().mockResolvedValue(undefined),
    };
    execute = jest.fn().mockResolvedValue([{ held: true }]);
    entityManager = {
      clear: jest.fn(),
      transactional: jest.fn(),
    };
    withTransactionContext(TRANSACTION);

    const logger = {
      getLogger: () => ({ info: jest.fn(), error: jest.fn() }),
    } as unknown as WinstonLoggerService;

    startupService = new StartupService(
      { migrator } as unknown as MikroORM,
      entityManager as unknown as EntityManager,
      logger,
    );

    delete process.env.DB_MIGRATION_LOCK_NAME;
    delete process.env.DB_MIGRATION_LOCK_TIMEOUT_MS;
    delete process.env.DB_MIGRATION_LOCK_POLL_MS;
  });

  it('applies pending migrations and clears the identity map', async () => {
    migrator.up.mockResolvedValue([{ name: 'Migration1' }]);

    await startupService.initialize();

    expect(migrator.up).toHaveBeenCalledTimes(1);
    expect(entityManager.clear).toHaveBeenCalledTimes(1);
  });

  it('does not clear the identity map when nothing was pending', async () => {
    migrator.up.mockResolvedValue([]);

    await startupService.initialize();

    expect(entityManager.clear).not.toHaveBeenCalled();
  });

  // The point of the apply-only model: generating on boot runs unreviewed SQL
  // against whatever database the container points at, and makes a rollback
  // generate a migration that undoes the schema change.
  it('never generates a migration, pending or not', async () => {
    migrator.up.mockResolvedValue([{ name: 'Migration1' }]);
    await startupService.initialize();

    migrator.up.mockResolvedValue([]);
    await startupService.initialize();

    expect(migrator.create).not.toHaveBeenCalled();
  });

  it('fails startup when a migration cannot be applied', async () => {
    migrator.up.mockRejectedValue(new Error('relation already exists'));

    await expect(startupService.initialize()).rejects.toThrow(
      'relation already exists',
    );
    expect(entityManager.clear).not.toHaveBeenCalled();
  });

  describe('migration lock', () => {
    // Acquiring the lock after discovery would be useless: both replicas
    // would compute the same pending list, serialize on the lock, and the
    // second would still try to re-apply what the first just applied.
    it('takes the lock before running the migrator', async () => {
      const callOrder: string[] = [];
      execute.mockImplementation(() => {
        callOrder.push('lock');
        return Promise.resolve([{ held: true }]);
      });
      migrator.up.mockImplementation(() => {
        callOrder.push('up');
        return Promise.resolve([]);
      });

      await startupService.initialize();

      expect(callOrder).toEqual(['lock', 'up']);
    });

    it('uses the transaction-scoped lock so a pooled connection cannot leak it', async () => {
      await startupService.initialize();

      expect(execute).toHaveBeenCalledWith(
        expect.stringContaining('pg_try_advisory_xact_lock'),
        [expect.stringContaining('db_migration')],
        'all',
        TRANSACTION,
      );
    });

    // `connection.execute(sql, params)` does not inherit the surrounding
    // `transactional()` callback — it takes a pooled connection, where an
    // xact-scoped lock is released as soon as the statement returns. The
    // fourth argument is the whole guarantee, so it is asserted on its own.
    it('runs the lock statement on the transaction, not a pooled connection', async () => {
      await startupService.initialize();

      const [, , , ctx] = execute.mock.calls[0];
      expect(ctx).toBe(TRANSACTION);
    });

    // Same reason on the other side: the migrator opens its own connection
    // unless it is handed one, which would put the migration outside the
    // session that holds the lock.
    it('runs the migration on the same transaction that holds the lock', async () => {
      await startupService.initialize();

      expect(migrator.up).toHaveBeenCalledWith({ transaction: TRANSACTION });
    });

    // Cheap insurance against a future MikroORM change: if `transactional()`
    // ever stops exposing a context, a silently unprotected migration is a
    // far worse outcome than a failed boot.
    it('refuses to start when no transaction context is available', async () => {
      withTransactionContext(undefined);

      await expect(startupService.initialize()).rejects.toThrow(
        /No transaction context/,
      );
      expect(execute).not.toHaveBeenCalled();
      expect(migrator.up).not.toHaveBeenCalled();
    });

    it('waits for a lock held by another instance, then proceeds', async () => {
      process.env.DB_MIGRATION_LOCK_POLL_MS = '1';
      grantLockOnAttempt(3);
      migrator.up.mockResolvedValue([{ name: 'Migration1' }]);

      await startupService.initialize();

      expect(execute).toHaveBeenCalledTimes(3);
      expect(migrator.up).toHaveBeenCalledTimes(1);
    });

    // Skipping is correct for a bootstrap-admin style task and wrong here: a
    // replica that skipped would serve traffic against an unmigrated schema.
    it('fails startup rather than skipping when the lock never frees', async () => {
      process.env.DB_MIGRATION_LOCK_POLL_MS = '1';
      process.env.DB_MIGRATION_LOCK_TIMEOUT_MS = '5';
      execute.mockResolvedValue([{ held: false }]);

      await expect(startupService.initialize()).rejects.toThrow(
        /Timed out .* waiting for the migration lock/,
      );
      expect(migrator.up).not.toHaveBeenCalled();
    });

    it('honours a custom lock name', async () => {
      process.env.DB_MIGRATION_LOCK_NAME = 'shared_schema_owner';

      await startupService.initialize();

      expect(execute).toHaveBeenCalledWith(
        expect.any(String),
        ['shared_schema_owner'],
        'all',
        TRANSACTION,
      );
    });

    it('rejects a malformed timeout instead of silently defaulting', async () => {
      process.env.DB_MIGRATION_LOCK_TIMEOUT_MS = 'soon';

      await expect(startupService.initialize()).rejects.toThrow(
        /DB_MIGRATION_LOCK_TIMEOUT_MS must be a positive integer/,
      );
    });
  });
});
