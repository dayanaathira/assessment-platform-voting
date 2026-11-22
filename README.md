# Feature Voting Platform

Product-feedback platform: users submit feature requests, vote, comment and
follow progress; admins change status, post official responses, merge
duplicates and view usage statistics.

| Folder | What | Details |
| --- | --- | --- |
| [`feature-voting/`](feature-voting/) | API: NestJS, MikroORM, PostgreSQL, JWT | [API README](feature-voting/README.md) |
| [`web/`](web/) | Frontend: Angular 22, served by nginx | [Web README](web/README.md) |
| [`docker-compose.yml`](docker-compose.yml) | Postgres + API + seed + web | below |

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

Postgres is never published to the host.

## Run without Docker (development)

See the [API README](feature-voting/README.md#quick-start) and the
[Web README](web/README.md#quick-start): API on `:3000`, `npm start` in `web/`
on `:4200`.

## Tests

```bash
cd feature-voting && npm test                 # API unit tests
cd web && npx ng test --watch=false           # frontend unit tests
```
