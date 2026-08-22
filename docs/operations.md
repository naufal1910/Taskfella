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

The check is tied to the migration hash in `src/server/db/client.ts`, not merely to the existence of the Drizzle ledger or product tables. After Phase 2, this includes the account-owned projects, columns, swimlanes, labels, lifecycle events, workflow indexes, and deferred workflow-invariant triggers. Run `pnpm db:migrate` before relying on readiness after deploying the Phase 2 migration. This preserves the empty-ledger and stale-ledger failure behavior from Phase 0.

Responses include request and correlation IDs for support while excluding connection strings, exception details, and user content.

## Authentication client addresses

`AUTH_TRUSTED_PROXY=false` is safe for direct local development and rejects client-supplied forwarding headers. The repository's Next development proxy marks its own forwarding hop so browser mutations still use one bounded local rate-limit bucket. Production configuration requires `AUTH_TRUSTED_PROXY=true` and a reverse proxy that strips incoming `X-Real-IP` and `X-Forwarded-For` values before setting one from the connecting client. Requests without a valid trusted address are rejected instead of sharing one production rate-limit bucket.

## Local transactional email

Phase 1B defaults non-production environments to `EMAIL_DELIVERY_MODE=local`. Verification and reset messages are written as mode `0600` JSON artifacts below the ignored `.local/mail/` directory; they are not logged or returned by an API. Inspect with `ls -lt .local/mail/` and clean up with `rm -rf .local/mail/`. Set `EMAIL_LOCAL_CAPTURE_DIR` to a temporary directory in automated tests when needed.

Production startup rejects local delivery. Set `AUTH_TRUSTED_PROXY=true` behind the trusted edge, then set `EMAIL_DELIVERY_MODE=smtp`, `EMAIL_SMTP_HOST`, and `EMAIL_FROM`, and configure the documented port, TLS mode, and optional paired SMTP credentials. The app uses the portable SMTP transport and never falls back to local capture.

Verification and password-reset link handling, including fragment-based bearer submission and legacy query compatibility, is defined in the [Phase 1B implementation note](implementation/taskfella-phase1b-auth.md).

## Projects and boards

Phase 2 uses the same single PostgreSQL database and authenticated session boundary as Phase 1. `GET /api/projects` and the project/board routes derive the account owner from the opaque session; client-supplied account IDs are never authorization inputs. Mutations use the existing same-origin plus double-submit CSRF boundary.

A project is created with the Personal Project, Simple, or Blank template. Blank is intentionally seeded with one active `In Progress` column and one completed `Done` column so it is valid before customization. Projects can be archived and restored without removing their columns, optional swimlanes, labels, or lifecycle events. Permanent deletion is available only through the explicit permanent-delete endpoint with the exact project name as confirmation.

Workflow columns have one semantic role, an independent position, optional completed grouping, and column-level WIP mode/limit. The database has a partial unique active-column index plus a deferred PostgreSQL constraint trigger that checks exactly one active and at least one completed column at transaction commit. Server workflow mutations lock the owning project and use revision preconditions; a completion-role transition requires an explicit confirmation flag. The WIP policy is implemented in `src/server/modules/workflow/wip.ts` as the future Phase 3 task-move boundary: authoritative task counts must be read inside the same project-locked transaction, `warn` requires a confirmation retry, and `enforce` rejects overflow.

Phase 2 deliberately does not create task execution, focus, collaboration, sharing, assignees, timers, analytics, exports, or external credentials. The responsive board foundation is available at `/projects` and `/projects/:projectId`; desktop/tablet show a multi-column board and mobile provides one-column selection plus bottom navigation.

## Google OAuth

Google credentials are optional in local development; when omitted, sign-in and linking use the safe not-configured outcomes described in the [Phase 1C implementation note](implementation/taskfella-phase1c-google-oauth.md). Email/password authentication remains available. If either value is supplied, both must be supplied and valid; production startup refuses missing, partial, or malformed configuration.

Use a Google OAuth **Web application** client and register this exact callback URL:

```text
http://localhost:3000/api/auth/google/callback
```

For deployment, replace only the origin with the HTTPS `APP_URL`, for example `https://taskfella.example/api/auth/google/callback`. Copy the commented `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` placeholders from `.env.example` into the local `.env` only after creating the client. Never commit or print their values. The server requests only `openid email`, uses state plus S256 PKCE, and does not request or store refresh tokens.

The account page's **Link Google account** action is an explicit authenticated ceremony. A Google email matching an existing account during sign-in is never silently linked; sign in with the existing method first and then start linking from that account. See the [Phase 1C implementation note](implementation/taskfella-phase1c-google-oauth.md) for callback, conflict, replay, and session-rotation semantics.

## Production lifecycle

Build the image with `docker build -t taskfella:local .`. Supply `DATABASE_URL`, `APP_URL`, the required SMTP settings, and the Google OAuth client pair only at runtime, run `pnpm db:migrate` from a controlled deployment environment, then start the standalone image. PostgreSQL backups, TLS termination, and secret delivery belong to the deployment environment. Opaque session tokens do not require a deployment-wide session secret.
