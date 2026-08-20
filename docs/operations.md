# Foundation operations

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

- `200` and `status: "ok"` when the application is running and PostgreSQL has the latest required migration applied;
- `503` and `status: "degraded"` when PostgreSQL is unavailable or the latest required migration has not been applied.

The check is tied to the migration hash in `src/server/db/client.ts`, not merely to the existence of the Drizzle ledger or product tables. This preserves the empty-ledger and stale-ledger failure behavior from Phase 0.

Responses include request and correlation IDs for support while excluding connection strings, exception details, and user content.

## Authentication client addresses

`AUTH_TRUSTED_PROXY=false` is safe for direct local development and rejects forwarding headers. Production configuration requires `AUTH_TRUSTED_PROXY=true` and a reverse proxy that strips incoming `X-Real-IP` and `X-Forwarded-For` values before setting one from the connecting client. Requests without a valid trusted address are rejected instead of sharing one production rate-limit bucket.

## Local transactional email

Phase 1B defaults non-production environments to `EMAIL_DELIVERY_MODE=local`. Verification and reset messages are written as mode `0600` JSON artifacts below the ignored `.local/mail/` directory; they are not logged or returned by an API. Inspect with `ls -lt .local/mail/` and clean up with `rm -rf .local/mail/`. Set `EMAIL_LOCAL_CAPTURE_DIR` to a temporary directory in automated tests when needed.

Production startup rejects local delivery. Set `AUTH_TRUSTED_PROXY=true` behind the trusted edge, then set `EMAIL_DELIVERY_MODE=smtp`, `EMAIL_SMTP_HOST`, and `EMAIL_FROM`, and configure the documented port, TLS mode, and optional paired SMTP credentials. The app uses the portable SMTP transport and never falls back to local capture.

## Production lifecycle

Build the image with `docker build -t taskfella:local .`. Supply `DATABASE_URL`, `APP_URL`, and the required SMTP settings only at runtime, run `pnpm db:migrate` from a controlled deployment environment, then start the standalone image. PostgreSQL backups, TLS termination, and secret delivery belong to the deployment environment. Opaque session tokens do not require a deployment-wide session secret.
