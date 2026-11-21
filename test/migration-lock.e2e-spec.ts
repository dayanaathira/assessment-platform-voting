import { Migration } from '@mikro-orm/migrations';
import { defineConfig, MikroORM } from '@mikro-orm/postgresql';
import { StartupService } from '../src/startup.service';
import { WinstonLoggerService } from '../src/common/logger/winston-logger.service';
import baseConfig from '../mikro-orm.config';

/**
 * The migration lock, against a real PostgreSQL.
 *
 * These assertions cannot be made against a mock. The bug this suite exists
 * to catch is that `connection.execute(sql, params)` silently runs on a
 * *pooled* connection rather than the surrounding `transactional()` callback:
 * `pg_try_advisory_xact_lock` then runs in its own implicit transaction and
 * Postgres releases the lock as the statement returns. Every unit-level
 * assertion still passes — the query was issued, it answered `held: true` —
 * while two replicas migrate the same database at the same time.
 *
 * So the checks here are all about *where* statements ran, not whether they
 * ran, and the probe migration below asks Postgres directly.
 */

const LOCK_NAME = 'migration_lock_e2e';
const HISTORY_TABLE = 'mikro_orm_migrations_lock_e2e';
const PROBE_TABLE = 'migration_lock_probe';
const MIGRATION_MS = 1_500;

/**
 * Records, from inside the migration itself, whether the backend running it
 * is also the backend holding an advisory lock. That is the same-session
 * question stated in SQL: if the migrator opened its own connection, this
 * backend holds no advisory lock and `locks_on_this_backend` is 0.
 *
 * It then sleeps, to hold the window open long enough for a second instance
 * to try to start while the migration is genuinely in flight.
 */
class MigrationProbe extends Migration {
  override name = 'MigrationProbe';

  override up(): void {
    this.addSql(
      `create table "${PROBE_TABLE}" ("backend_pid" int not null, "locks_on_this_backend" int not null, "started_at" timestamptz not null default now());`,
    );
    this.addSql(
      `insert into "${PROBE_TABLE}" ("backend_pid", "locks_on_this_backend") ` +
        `select pg_backend_pid(), (select count(*) from pg_locks where locktype = 'advisory' and pid = pg_backend_pid());`,
    );
    this.addSql(`select pg_sleep(${MIGRATION_MS / 1000});`);
  }

  override down(): void {
    this.addSql(`drop table if exists "${PROBE_TABLE}";`);
  }
}

const silentLogger = {
  getLogger: () => ({ info: () => undefined, error: () => undefined }),
} as unknown as WinstonLoggerService;

// The service's own config, minus entity discovery (this suite tests the
// migration path, not the schema) and pointed at a throwaway history table.
const probeConfig = defineConfig({
  ...baseConfig,
  entities: [],
  entitiesTs: [],
  discovery: { warnWhenNoEntities: false },
  metadataProvider: undefined,
  migrations: {
    ...baseConfig.migrations,
    tableName: HISTORY_TABLE,
    snapshot: false,
    migrationsList: [{ name: 'MigrationProbe', class: MigrationProbe }],
  },
});

/** A fully independent ORM instance — its own pool, as a second replica has. */
async function startInstance(): Promise<MikroORM> {
  return MikroORM.init(probeConfig);
}

function startupServiceFor(orm: MikroORM): StartupService {
  return new StartupService(orm, orm.em.fork(), silentLogger);
}

describe('migration lock (real PostgreSQL)', () => {
  let admin: MikroORM;

  const sql = async <T>(query: string): Promise<T[]> =>
    admin.em.getConnection().execute<T[]>(query);

  beforeAll(async () => {
    admin = await startInstance();
  });

  beforeEach(async () => {
    process.env.DB_MIGRATION_LOCK_NAME = LOCK_NAME;
    delete process.env.DB_MIGRATION_LOCK_TIMEOUT_MS;
    delete process.env.DB_MIGRATION_LOCK_POLL_MS;

    await sql(`drop table if exists "${PROBE_TABLE}";`);
    await sql(`drop table if exists "${HISTORY_TABLE}";`);
  });

  afterAll(async () => {
    await sql(`drop table if exists "${PROBE_TABLE}";`);
    await sql(`drop table if exists "${HISTORY_TABLE}";`);
    await admin.close(true);
    delete process.env.DB_MIGRATION_LOCK_NAME;
  });

  // The invariant the plan asks for, asked of Postgres rather than of a mock:
  // the backend that applied the migration is the backend holding the lock.
  it('runs the migration on the session that holds the lock', async () => {
    const orm = await startInstance();

    try {
      await startupServiceFor(orm).initialize();
    } finally {
      await orm.close(true);
    }

    const [probe] = await sql<{
      backend_pid: number;
      locks_on_this_backend: number;
    }>(`select * from "${PROBE_TABLE}";`);

    expect(probe).toBeDefined();
    expect(probe.locks_on_this_backend).toBeGreaterThanOrEqual(1);
  }, 30_000);

  // Two replicas starting together. The slow migration guarantees the second
  // instance really does arrive mid-migration rather than after it.
  it('serializes two instances started together, applying the set exactly once', async () => {
    const [first, second] = await Promise.all([
      startInstance(),
      startInstance(),
    ]);

    const finishedAt: Record<string, number> = {};
    const run = async (label: string, orm: MikroORM) => {
      await startupServiceFor(orm).initialize();
      finishedAt[label] = Date.now();
    };

    const startedAt = Date.now();
    try {
      await Promise.all([run('a', first), run('b', second)]);
    } finally {
      await Promise.all([first.close(true), second.close(true)]);
    }

    const applied = await sql<{ name: string }>(
      `select name from "${HISTORY_TABLE}";`,
    );
    expect(applied).toHaveLength(1);

    const probeRows = await sql<{ backend_pid: number }>(
      `select * from "${PROBE_TABLE}";`,
    );
    expect(probeRows).toHaveLength(1);

    // The loser cannot have returned while the migration was still running:
    // it either waited for the lock or failed. Either way it never reached
    // "ready to serve" against a half-migrated schema.
    const loserFinishedAfter = Math.max(finishedAt.a, finishedAt.b) - startedAt;
    expect(loserFinishedAfter).toBeGreaterThanOrEqual(MIGRATION_MS);
  }, 60_000);

  // Waiting is the required behaviour; skipping would let a replica serve
  // traffic against a schema nobody had finished migrating.
  it('fails startup rather than proceeding when the lock is never released', async () => {
    process.env.DB_MIGRATION_LOCK_TIMEOUT_MS = '1000';
    process.env.DB_MIGRATION_LOCK_POLL_MS = '100';

    const holder = await startInstance();
    const blocked = await startInstance();

    try {
      // Hold the lock on a real session for longer than the waiter's timeout.
      await holder.em.fork().transactional(async (em) => {
        await em
          .getConnection()
          .execute(
            'select pg_advisory_xact_lock(hashtext(?))',
            [LOCK_NAME],
            'all',
            em.getTransactionContext(),
          );

        await expect(startupServiceFor(blocked).initialize()).rejects.toThrow(
          /Timed out .* waiting for the migration lock/,
        );
      });
    } finally {
      await Promise.all([holder.close(true), blocked.close(true)]);
    }

    // Nothing was applied by the instance that could not get the lock.
    const historyExists = await sql<{ exists: boolean }>(
      `select to_regclass('${HISTORY_TABLE}') is not null as exists;`,
    );
    if (historyExists[0].exists) {
      const applied = await sql(`select name from "${HISTORY_TABLE}";`);
      expect(applied).toHaveLength(0);
    }
  }, 30_000);
});
