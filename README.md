# Feature Voting Platform

Product-feedback platform: users submit feature requests, vote, comment and
follow progress; admins change status, post official responses, merge
duplicates and view usage statistics.

| Folder | What | Details |
| --- | --- | --- |
| [`feature-voting/`](feature-voting/) | API: NestJS, MikroORM, PostgreSQL, JWT | [API README](feature-voting/README.md) |
| [`web/`](web/) | Frontend: Angular 22, served by nginx | [Web README](web/README.md) |
| [`docker-compose.yml`](docker-compose.yml) | Postgres + API + seed + web | below |

## Live demo

**https://dayana.cloud**: the same `docker compose` setup on a single VPS, behind
host nginx with Let's Encrypt. Demo logins are sent with the submission, not
kept in the repo.

Swagger is left on here on purpose, so reviewers can try the API directly:
https://dayana.cloud/feature-voting/api-docs. A real production deployment
would set `SWAGGER_ENABLED=false` (see [On a server](#on-a-server)).

## Where to read

| Topic | Section |
| --- | --- |
| Authorization, transactions, uniqueness, concurrency | [API: Integrity](feature-voting/README.md#integrity) |
| Backend decisions and rejected alternatives | [API: Decisions](feature-voting/README.md#decisions-and-rejected-alternatives) |
| Frontend architecture and state | [Web: Architecture](web/README.md#architecture), [State management](web/README.md#state-management) |
| Frontend decisions and rejected alternatives | [Web: Decisions](web/README.md#decisions-and-rejected-alternatives) |
| Complete, partial and deferred | [API: Scope](feature-voting/README.md#scope), [Web: Scope](web/README.md#scope) |
| Risks and next steps | [API: Risks and next steps](feature-voting/README.md#risks-and-next-steps) |
| Tests | [API: Testing](feature-voting/README.md#testing), [Web: Testing](web/README.md#testing) |

## Run everything with Docker

**Prerequisites:** Docker with the Compose plugin (`docker compose version`).

```bash
cp .env.example .env
# Edit .env: set POSTGRES_PASSWORD, JWT_SECRET, JWT_REFRESH_SECRET,
# SEED_ADMIN_PASSWORD, SEED_USER_PASSWORD (openssl rand -base64 48 for secrets)

docker compose up -d --build
docker compose ps        # db, api, web healthy; seed "exited (0)"
```

| | URL |
| --- | --- |
| App | `http://localhost:8080` |
| Swagger | `http://localhost:3000/feature-voting/api-docs` |

Log in as `admin` (`SEED_ADMIN_PASSWORD`) or `user1`–`user3` (`SEED_USER_PASSWORD`).

What happens on `up`: Postgres starts → the API applies migrations on boot and
reports ready → `seed` adds statuses, roles and users (idempotent, safe on
every start) → nginx serves the app and proxies `/feature-voting` to the API.

| Task | Command |
| --- | --- |
| Follow API logs | `docker compose logs -f api` |
| Re-run the seed | `docker compose run --rm seed` |
| Rebuild after a code change | `docker compose up -d --build` |
| Stop (keep data) | `docker compose down` |
| Stop and delete the database | `docker compose down -v` |
| Open psql | `docker compose exec db psql -U feature_voting -d feature_voting` |

### On a server

Set these in `.env`:

- `WEB_ORIGIN`: the address people open, e.g. `http://203.0.113.10:8080` or
  `https://feedback.example.com`.
- `SWAGGER_ENABLED=false` on a public server, and don't open `API_PORT` in the
  firewall; the app only needs `WEB_PORT`. The browser reaches the API through
  nginx.
- Put TLS and rate limiting in front (a reverse proxy, load balancer or ingress).

Behind nginx on the same host, also set:

- `BIND_ADDR=127.0.0.1` so `WEB_PORT` and `API_PORT` only listen locally.
  Docker publishes ports past `ufw`, so the firewall alone doesn't block them.
- `TRUST_PROXY_HOPS=2` (host nginx + the web container's nginx) so the API
  sees the client's real IP.
- Point nginx at `http://127.0.0.1:8080`.

Postgres is never published to the host.

## Run without Docker (development)

See the [API README](feature-voting/README.md#quick-start) and the
[Web README](web/README.md#quick-start): API on `:3000`, `npm start` in `web/`
on `:4200`.

## Tests

```bash
cd feature-voting && npm test                 # API unit tests
cd feature-voting && npm run test:live        # concurrency, against a deployed instance
cd web && npx ng test --watch=false           # frontend unit tests
```

The live suite needs `LIVE_ADMIN_PASSWORD` and `LIVE_TEST_USER_PASSWORD`; see
[API: Testing](feature-voting/README.md#testing) for what it checks and the
data it leaves.
