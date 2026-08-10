# Phase 1A authentication foundation

Phase 1A adds server/domain primitives only. It does not add signup, login, logout, email delivery, password-reset, Google OAuth routes, or authentication UI.

## Database boundary

`src/server/db/schema.ts` is the source of truth for the account, credential, identity, session, verification-token, reset-token, and authentication rate-limit tables. Every account-owned authentication record—credential, identity, session, verification-token, and reset-token—carries an explicit `account_id`; the rate-limit table intentionally uses only hashed operation/subject keys. Account deletion cascades through the account-owned authentication records. Email identity is compared through the trimmed, Unicode-normalized lowercase `normalized_email` column and its unique index. All exact timestamps use PostgreSQL `timestamp with time zone` values.

`drizzle/0001_strong_purple_man.sql` creates the authentication tables and `drizzle/0002_dizzy_banshee.sql` adds the session-rotation self-reference. Readiness in `src/server/db/client.ts` checks the hash of the latest required migration, so a reachable database with an empty or stale ledger remains degraded.

## Credential and bearer-token handling

Passwords use the maintained `@node-rs/argon2` native package with Argon2id and version 19 parameters in `src/server/modules/auth/password.ts`. The package supplies prebuilt Node/Docker-compatible native binaries, avoiding a broad authentication framework and avoiding an Alpine build-tool requirement. Password credential repository functions verify hashes without returning them.

Session, email-verification, and password-reset values are generated from Node's cryptographically secure random source. Only SHA-256 digests of those bearer values are stored; raw values are available only to the immediate caller that must place a value in a cookie or delivery message. Verification and reset consumption use one conditional database update (`consumed_at IS NULL` and `expires_at > now`) so retries and concurrent consumers are single-use.

Sessions are opaque, database-backed, account-bound, expiring, rotatable, and revocable. `taskfella_session` is HttpOnly, `SameSite=Lax`, path-rooted, and Secure in production while remaining usable over local HTTP in development. No deployment-wide session secret is required because the bearer value is random and only its digest is persisted.

## Trust boundaries

`src/server/http/authentication.ts` resolves the account from the session cookie and database, and `protectedRoute` passes that account to route handlers. It never authorizes from a client-supplied account ID. Mutation boundaries call `validateCsrfRequest`, which requires a same-origin Origin (or same-origin Referer when Origin is absent) and a constant-time matching `x-csrf-token`/readable CSRF-cookie pair. `GET /api/auth/csrf` issues the cookie without returning the token in JSON.

`consumeRateLimit` implements atomic fixed-window buckets in PostgreSQL with hashed operation/subject keys, bounded attempts, expiry, and a maintenance prune primitive. Presets cover login, signup, verification, reset, and OAuth failure operations without Redis or another service.

Authentication logs use the existing technical allow-list and record only request/correlation IDs, route metadata, status, and stable error codes. Passwords, raw bearer values, OAuth material, and user payloads are not log fields.

Focused coverage is in `tests/unit/*auth*.test.ts` and `tests/integration/auth-foundation.test.ts`. Run database-backed coverage with a running Compose PostgreSQL instance after `pnpm db:migrate`.
