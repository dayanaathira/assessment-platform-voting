// The MikroORM CLI loads this file directly, without going through main.ts,
// so the config has to load .env itself.
import 'dotenv/config';
import { Migrator } from '@mikro-orm/migrations';
import { defineConfig } from '@mikro-orm/postgresql';
import { MetadataProvider } from '@mikro-orm/core'; // Changed to Reflect for defineEntity support
import { SERVICE_NAME } from './src/app.constants';

// Migration history table name. Derived from SERVICE_NAME so this service owns
// its own history even when several services share one database — MikroORM
// tracks applied migrations by name, so a shared table lets one service's
// migration silently satisfy another's identically-named one.
const MIGRATION_TABLE_NAME = `mikro_orm_migrations_${SERVICE_NAME.replace(/-/g, '_')}`;

export default defineConfig({
  host: process.env.POSTGRES_HOST,
  port: parseInt(process.env.POSTGRES_PORT!),
  user: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASS,
  dbName: process.env.POSTGRES_NAME,
  schema: process.env.POSTGRES_SCHEMA,
  // ===================================================================
  // Timezone
  // ===================================================================
  forceUtcTimezone: false,
  timezone: '+08:00',
  // ===================================================================
  // CRITICAL: Connection Pool Configuration
  // ===================================================================
  pool: {
    min: 0,
    max: 10,
    acquireTimeoutMillis: 30000,
    idleTimeoutMillis: 10000,
    createTimeoutMillis: 30000,
    reapIntervalMillis: 1000,
  } as any,
  // ===================================================================
  // Driver Options for pg
  // ===================================================================
  driverOptions: {
    connectionTimeoutMillis: 60000,
  },
  entities: ['./dist/**/*.entity.js'], // File paths for entity definitions (compiled)
  entitiesTs: ['src/**/*.entity.ts'], // File paths for entity definitions (source)
  metadataProvider: MetadataProvider,
  discovery: {
    // Re-enabled: this service now has entities (src/modules/ldic-application/entities),
    // so a broken glob should fail loudly instead of silently booting with none.
    warnWhenNoEntities: true,
    // Prevents the glob engine from throwing "Duplicate table names" when tracking
    // class-extended defineEntity wrappers simultaneously.
    checkDuplicateTableNames: false,
  },
  // RequestContext middleware is wired in main.ts, and startup work runs
  // inside an explicit RequestContext, so nothing needs the global context.
  // Leaving this on hides real identity-map bleed between requests.
  allowGlobalContext: false,
  metadataCache: { enabled: false },
  extensions: [
    Migrator, // Handle migrations, generate, apply and revert
  ],
  migrations: {
    tableName: MIGRATION_TABLE_NAME,
    glob: '!(*.d).{js,ts}',
    path: 'dist/migrations',
    pathTs: 'migrations',
    transactional: true,
    disableForeignKeys: true,
    allOrNothing: true,
    dropTables: false,
    safe: false,
    snapshot: true,
    emit: 'ts',
    snapshotName: `.snapshot-${SERVICE_NAME}`,
  },
});
