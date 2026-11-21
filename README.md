# Feature Voting

The NestJS backend service for Feature Voting.

It ships **no entities and no migrations** yet. It creates nothing in your
database beyond its own migration history table, so the first table in there
is one you wrote.

Logging, error handling, seeding and request IDs live in
[`src/common/`](src/common/).

Where this README and the code disagree, the code wins.

## Quick start

```bash
cp .env.example .env
npm ci
npm run migration:up          # apply committed migrations
npm run start:dev
```

You need a Postgres to point at — a local install is fine, and there is
nothing to containerise. Set the `POSTGRES_*` values in `.env` to match it;
`.env.example` assumes the default `localhost:5432`. The service creates
nothing beyond its own migration history table, so an empty database is the
right starting point.

Then:

- API: <http://localhost:3000/feature-voting/v1>
- Swagger: <http://localhost:3000/feature-voting/api-docs>
- Probes: <http://localhost:3000/health> and <http://localhost:3000/ready>

Requires Node >= 22.12. MikroORM v7 is ESM-only and the CommonJS build
`require()`s it, which older Node cannot do.

## Stripping down

The repo ships as **HTTP + migration owner**. For the other shapes:
Rows marked **optional** are feature slices, not requirements. If a service
does not use one, remove the slice's package, configuration, and module wiring
along with its source folder rather than leaving a disabled stub behind.

| You are building | Remove |
| --- | --- |
| A service that only *reads* tables another service owns | `@mikro-orm/migrations`, `@mikro-orm/cli`, the `migration:*` scripts, `migrations/`, and the `StartupService` migration block. A read-only consumer must ship no migration tooling at all. |
| A service with no browser clients (**optional CORS slice**) | `CORS_ORIGINS` from `src/config/env.validation.ts` and the `enableCors()` call in `main.ts`. Leaving CORS off beats configuring it decoratively. |
| A service with no database | All of the above, plus `MikroOrmModule`, `mikro-orm.config.ts` and the database check in `HealthService`. |

## Migrations

**The application applies migrations. It never generates them.**

Generating on boot means unreviewed SQL runs against whatever database the
container points at, the file recording it is lost when the container
restarts, and rollback becomes a data-loss path — redeploy the previous image
and the old entities diff against the new schema, so the old pod generates
and applies a migration undoing your change.

### Authoring workflow

```bash
# 1. edit your entity, then generate a draft
npm run migration:create -- --name what-it-does

# 2. READ AND EDIT the generated SQL   <- this is the safety mechanism
# 3. verify locally
npm run migration:up

# 4. commit the migration with the entity change
```

Step 2 is not a formality. An entity diff cannot tell a rename from a
drop-plus-add: renaming `fullName` to `name` generates
`DROP COLUMN full_name; ADD COLUMN name;` — correct-looking SQL,
correct-looking result, every value in that column gone. Hand-edit it to
`ALTER ... RENAME`, or split it into expand/contract across two releases.

Expand/contract matters generally: with a rolling deploy there is always a
window where old pods serve traffic against the new schema. Destructive
changes go add → backfill → cut reads over → drop in a *later* release.

The requirement is **reviewed**, not hand-typed. Generating the draft is
fine; owning what it contains is the point.

`migrations/.snapshot-feature-voting.json` is how MikroORM diffs your
entities. It is committed on purpose — delete it and the next
`migration:create` regenerates your whole schema as a new migration. It ships
holding an empty schema, so your first `migration:create` emits exactly your
own tables.

### What a reviewed migration looks like

The generator emits only `up()`, and only what the diff implies. These are the
edits worth making by hand every time:

```ts
export class Migration20260101000000_create_widgets extends Migration {
  // A descriptive suffix. Two services migrating into one database cannot
  // then record the same migration name and silently skip each other's work.
  override name = 'Migration20260101000000_create_widgets';

  override up(): void | Promise<void> {
    // `if not exists`, so a re-run against a partially-migrated database is
    // not fatal. Guard the constraints too, not just the table — a bare
    // `add constraint` still fails on the second run.
    this.addSql(
      `create table if not exists "widgets" ("id" serial primary key, "label" varchar(255) not null);`,
    );
  }

  // The generator does not emit `down()`. Without one, `migration:down`
  // does nothing and there is no rehearsed way back.
  override down(): void | Promise<void> {
    this.addSql(`drop table if exists "widgets";`);
  }
}
```

### Ownership

This service owns its own history table
(`mikro_orm_migrations_<service>`, derived from `SERVICE_NAME`), which is
safe whether or not the database turns out to be shared.

If several services share one database *and* one history table, MikroORM
tracks applied migrations by name, so on a fresh database the service that
boots second silently skips its own identically-named migration. Renaming
future migrations does not repair an existing collision — the name is already
recorded, and reconciling it means editing that table by hand.

A service that only reads another service's tables carries no migration
tooling and no startup migration block. See "Stripping down".

### The boot-time lock

`StartupService` holds a Postgres advisory lock across both discovery and
application, so two replicas starting together do not both apply the same
migrations. The replica that waits re-checks and normally finds nothing
pending. On timeout, startup **fails** rather than serving against a schema
nobody finished migrating. Tune with `DB_MIGRATION_LOCK_*` in `.env`.

The lock, the discovery read and the migration all run on **one** database
session, which is what makes the lock mean anything. Two details in
`startup.service.ts` carry that and are easy to undo by accident:
`connection.execute()` runs on a pooled connection unless it is passed the
transaction, and `migrator.up()` opens its own unless it is handed one. Get
either wrong and the lock reports success while holding nothing.
`test/migration-lock.e2e-spec.ts` checks this against a real PostgreSQL,
because no mock can see it.

### Forgetting a migration

Because nothing generates automatically, changing an entity and forgetting
the migration compiles fine and fails at runtime. `npm run check:migrations`
(and the `migration-check` CI job) fails a branch that touches an entity
without touching a migration.

## Seeding

Seeding does **not** run on boot. A service must not write rows into a
database as a side effect of a replica restarting.

```bash
npm run seed
```

Add a seeder under `src/common/seeds/` and pass it into
`DbSeederModule.forRoot([...])` in
[`app.module.ts`](src/modules/app/app.module.ts). Use `seedIfMissing`
([`seed.util.ts`](src/common/utils/seed.util.ts)) to insert-if-missing rather
than writing raw upserts, and keep seeders idempotent.

```ts
// src/common/seeds/example.seeder.ts
import { Seeder } from '@mikro-orm/seeder';
import { EntityManager } from '@mikro-orm/postgresql';
import { Example } from '../../modules/example/entities/example.entity';
import { seedIfMissing } from '../utils/seed.util';

export class ExampleSeeder extends Seeder {
  async run(entityManager: EntityManager): Promise<void> {
    await seedIfMissing(entityManager, Example, [
      { id: 1, name: 'First example' },
      { id: 2, name: 'Second example' },
    ]);
  }
}
```

```ts
// src/modules/app/app.module.ts
DbSeederModule.forRoot([ExampleSeeder]),
```

[`ExampleSeeder`](src/common/seeds/example.seeder.ts) ships as a worked
reference, alongside [`Example`](src/modules/example/entities/example.entity.ts)
— delete both once you have real entities to seed instead; they exist to show
the pattern, not to be kept.

## Configuration

Required configuration is validated at startup, before anything opens a
connection ([`env.validation.ts`](src/config/env.validation.ts)). A missing
or malformed value fails the boot with every problem listed at once, instead
of surfacing later as a confusing runtime error.

Add new required variables to that schema. `.env.example` is the reference.

## The HTTP boundary

- **CORS** is an explicit allowlist from `CORS_ORIGINS`, with no fallback —
  a default would mean staging silently accepting a localhost origin.
  `credentials` is off; turn it on only alongside real cookie auth and CSRF
  protection.
- **Validation**: `ValidationPipe({ whitelist: true, transform: true,
  forbidNonWhitelisted: true })`.
  `whitelist` strips unknown properties, which is the mass-assignment
  defense; `forbidNonWhitelisted` rejects them so client mistakes are visible.
- **Errors**: every failure leaves through `AllExceptionsFilter`
  ([`all-exceptions.filter.ts`](src/common/filters/all-exceptions.filter.ts))
  in one stable shape. 4xx messages pass through;
  anything 5xx is replaced with a generic message so driver text and SQL
  never reach the caller. Detail goes to the log.
- **Swagger** is off in production unless `SWAGGER_ENABLED=true`.

## Health checks

| Endpoint | Checks | Semantics |
| --- | --- | --- |
| `GET /health` | process liveness only | 200 as soon as the process is listening. Never touches the database — a brief blip must not restart healthy pods. Keeps returning 200 during graceful shutdown. |
| `GET /ready` | database connection | 503 while dependencies are unavailable, and immediately on `SIGTERM`. |

Both sit outside the API prefix and outside versioning, so probe URLs do not
move when the service is renamed.

Migrations run before `app.listen()`, so nothing answers at all during the
migration window. That is a **deployment** concern: cover it with a
`startupProbe` (or `initialDelaySeconds`), not by making liveness check the
database. This repo does not ship manifests.

## Logging

The logger is `nest-winston`, configured for structured JSON on stdout by
`WinstonLoggerModule` ([`src/common/logger/`](src/common/logger/)).

Application code uses the small `WinstonLoggerService` wrapper, not
`console.log`:

```ts
this.logger.getLogger().info('Something happened', {
  label: ExampleService.name + ' doSomething',
});
```

The `label` convention (`ClassName methodName`) is a convention, not enforced.
Each inbound request accepts a bounded `x-request-id` or receives a generated
one; the ID is returned in the response and added to application log records.

Never log secrets: no tokens, authorization headers, passwords, or raw
request bodies.

## Tests

```bash
npm test           # unit
npm run test:e2e   # e2e (needs a Postgres — see Quick start)
npm run test:cov   # coverage
```

Both suites run on `@swc/jest`. That is not a preference: MikroORM v7 and its
dependency tree are ESM-only, and Jest's CommonJS loader cannot require them.
`transformIgnorePatterns` is empty so those dependencies get transformed too.

## What a pipeline should verify

**This repo ships no pipeline.** Whatever CI you add should run these gates.

The gates, and the command that runs each, so they are identical wherever
they are wired:

| Gate | Command |
| --- | --- |
| Lint | `npm run lint:check` |
| Types | `npm run typecheck` |
| Unit tests | `npm test` |
| E2E tests | `npm run test:e2e` (needs a Postgres) |
| Forgotten migration | `npm run check:migrations` |
| Build | `npm run build` |

`npm run check:migrations` is the one worth asking for explicitly. It fails
when an entity changed but no migration did — the failure mode that apply-only
migrations create, and the one nothing else catches. See
[Forgetting a migration](#forgetting-a-migration).

## Worked example

`src/modules/example/` is a small vertical slice showing a DTO with
validation, a service, a controller, tests, an
entity ([`Example`](src/modules/example/entities/example.entity.ts)) and a
seeder ([`ExampleSeeder`](src/common/seeds/example.seeder.ts)), so the slice
demonstrates the pattern end to end: entity and seed data.

This is the one deliberate exception to "no entities and no migrations" at
the top of this README — it exists purely as a reference to copy from. Delete
`src/modules/example/` and `ExampleSeeder` once your service has real
entities; don't build on top of it.

## Request IDs and logging

The service accepts a bounded `x-request-id` at the inbound boundary or
generates one, returns it in the response, and includes it in structured JSON
logs written to stdout. Use `CorrelationHttpClient` for outbound native
`fetch` calls so the same ID is propagated to the next service.

### Client addresses behind a proxy

The access log records `req.ip`. Express derives that from its `trust proxy`
setting, and this repo leaves it off unless `TRUST_PROXY_HOPS` says how many
proxies really sit in front of the process:

| `TRUST_PROXY_HOPS` | `req.ip` for `X-Forwarded-For: 1.1.1.1, 2.2.2.2, 3.3.3.3` |
| --- | --- |
| unset | the socket peer — behind nginx, nginx's own address |
| `1` | `3.3.3.3` — what the one trusted proxy saw |
| `2` | `2.2.2.2` |

Setting Express's `trust proxy` to `true` instead of a count is the dangerous
option: `req.ip` becomes the leftmost `X-Forwarded-For` entry, which the
caller writes, so any client can put whatever address it likes in your logs.
That is why this is a hop count and there is no boolean form. It also changes
`req.protocol`, `req.secure`, and `req.hostname`.

## What this service expects at runtime

**No live Dockerfile or deployment manifests ship here either**, for the same
reason: image build, base-image policy, registries and orchestration are
DevOps decisions. [`Dockerfile`](Dockerfile) is present but **commented out as
a reference**, so a developer can see what this service needs from an image
rather than reconstructing it.

What a deployment has to provide is a short list:

- **Node >= 22.12.** MikroORM v7 is ESM-only and the CommonJS build
  `require()`s it, which older Node cannot do.
- **Entry point** is `npm run build`, then `node dist/src/main.js`.
- **Config from the environment**, never baked into an image.
  [`.env.example`](.env.example) is the full list; a missing or malformed
  required value fails the boot with a message naming it.
- **Probes**: liveness on `/health`, readiness on `/ready`, plus a
  `startupProbe` (or `initialDelaySeconds`) to cover the migration window —
  migrations run before the process listens, so nothing answers until they
  finish. Liveness must not check the database.
- **Replicas are safe to start together**; the migration lock serializes them.
- **Logs** are structured JSON on stdout. Keep file transports as an explicit
  opt-in only where a deployment needs them.
- **Do not set `NODE_OPTIONS=--max-old-space-size`.** A heap hint larger than
  the container's memory limit gets the process OOMKilled before V8 collects
  seriously. Node reads the cgroup limit itself.
- **Set `TRUST_PROXY_HOPS`** to the number of reverse proxies in front of the
  process, or the access log records the proxy's address for every caller —
  see [Client addresses behind a proxy](#client-addresses-behind-a-proxy).

## Known gaps

Deliberately not done yet, tracked in the plan:

- A `create-app` scaffolder. Cloning and hand-renaming is where drift starts,
  but the generator waits until repeated services actually show that drift.
- Auth and file-upload worked examples.
- Messaging (RabbitMQ producer/consumer, envelope, retry/DLQ). Deferred until
  a real adopter exists, so the contract is validated by something rather than
  derived from principle.

### Deliberately left out

Not gaps — removed on purpose, recorded here so the decision is not
re-litigated in every new service.

- **Rate limiting.** These are internal applications with a small, known user
  base, behind an nginx reverse proxy. Per-endpoint request ceilings buy
  little there: the callers are known, the traffic is not hostile, and a
  gateway is a better place to cap it if it ever needs capping. Shipping a
  limiter every service inherits and no service tunes is how a 429 reaches a
  legitimate client and the whole thing gets switched off.

  *(An earlier version of this note argued that being behind nginx makes
  IP-based limiting impossible. That is only true while Express is not told to
  trust the proxy — with `TRUST_PROXY_HOPS` set correctly, `req.ip` is the
  real client address and IP limiting works fine. See
  [Client addresses behind a proxy](#client-addresses-behind-a-proxy). The
  decision rests on the reasoning above, not on that.)*

  A service that is genuinely internet-facing, or that needs to protect one
  expensive endpoint, adds `@nestjs/throttler` itself.

  ⚠ **Two things to get right if you do.**

  First, `ThrottlerModule.forRoot()` only registers configuration — it does
  **not** bind the guard. Without the `APP_GUARD` provider below, nothing is
  rate limited and everything still looks wired.

  Second, `ThrottlerGuard.getTracker()` returns `req.ip` by default. For
  per-user limiting, pass a `getTracker` that returns the authenticated user's
  identifier (this repo ships no auth, so the shape is whatever your auth
  layer puts on the request):

  ```ts
  import { APP_GUARD } from '@nestjs/core';
  import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';

  @Module({
    imports: [
      ThrottlerModule.forRoot({
        throttlers: [{ ttl: 60_000, limit: 120 }],
        getTracker: (req) => req.user?.id ?? `anon:${req.ip}`,
      }),
    ],
    // Without this provider, the module above does nothing.
    providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
  })
  export class AppModule {}
  ```

  Two more that quietly undo it: the guard must run **after** authentication,
  or there is no user on the request yet; and anonymous callers need a key of
  their own, or they collapse into one bucket.

  If you track by IP rather than by user, set `TRUST_PROXY_HOPS` — otherwise
  `req.ip` is nginx's address and every caller really does share one bucket.
- **A scheduler.** Most services run no scheduled work, and an example cron
  job nobody uses is noise. A service that needs one adds
  `@nestjs/schedule`, imports `ScheduleModule.forRoot()`, and makes its own
  single-execution decision — a bare `@Cron` fires once per replica.
- **Live CI configuration, image builds, and deployment manifests.** DevOps
  owns the runners, registries, base-image policy, SonarQube and
  orchestration; config committed here would be this repo guessing at their
  environment, and a stale guess is worse than none.

  `Dockerfile` is still in the repo, **commented out**, as a starting point.

  The requirements themselves are in
  [What a pipeline should verify](#what-a-pipeline-should-verify) and
  [What this service expects at runtime](#what-this-service-expects-at-runtime).

- **A `docker-compose.yml` for local Postgres.** Removed: the team develops
  against a locally installed Postgres, and shipping a compose file forced
  `.env.example` to default to port 5433 to dodge it — so the shipped default
  was tuned for a container most developers never start. Point `.env` at
  whatever Postgres you already run.
