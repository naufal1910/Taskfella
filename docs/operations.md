# Phase 0 operations

## Local lifecycle

```bash
cp .env.example .env
pnpm install --frozen-lockfile
docker compose up -d --wait db
pnpm db:migrate
pnpm db:check
pnpm dev
```

Compose publishes PostgreSQL on host port `5433` (the container remains on port `5432`) so it can coexist with other local projects. Stop the local database with `pnpm db:stop`. To remove the local database volume as well, run `docker compose down -v`; this deletes only the disposable local PostgreSQL data.

## Health behavior

`GET /api/health` performs a connectivity and migration-ledger readiness check. It returns:

- `200` and `status: "ok"` when the application is running and PostgreSQL has the current Phase 0 migration applied;
- `503` and `status: "degraded"` when PostgreSQL is unavailable or the current migration has not been applied.

Responses include request and correlation IDs for support while excluding connection strings, exception details, and user content.

## Production lifecycle

Build the image with `docker build -t taskfella:local .`. Supply `DATABASE_URL` and `APP_URL` only at runtime, run `pnpm db:migrate` from a controlled deployment environment, then start the standalone image. PostgreSQL backups, TLS termination, and secret delivery belong to the deployment environment rather than this Phase 0 repository scaffold.
