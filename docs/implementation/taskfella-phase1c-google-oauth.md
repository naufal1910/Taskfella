# Phase 1C Google OAuth and explicit identity linking

Phase 1C adds Google sign-in to the Phase 1A/1B authentication foundation without replacing app-owned accounts, email/password credentials, or opaque sessions.

## Configuration

Google is optional in local development. Leave both variables unset to keep email/password authentication available; the Google action returns a clear not-configured state instead of silently using another provider.

```dotenv
GOOGLE_CLIENT_ID=replace-with-google-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=replace-with-google-client-secret
```

Both values are required together. Production startup rejects missing, partial, or malformed Google configuration. The client secret is read only by the server and is never returned to a browser, persisted in the database, or written to logs.

Create a Google OAuth **Web application** client and register this exact redirect URI, replacing only the origin with the deployed `APP_URL`:

```text
http://localhost:3000/api/auth/google/callback
https://your-production-origin.example/api/auth/google/callback
```

The callback uses the origin from `APP_URL`; do not add a client-supplied redirect target.

## OAuth boundary

- `GET /api/auth/google` starts sign-in.
- `POST /api/auth/google?intent=link` starts an explicit link from the currently authenticated account after the existing CSRF boundary; the account page obtains the provider URL through the JSON response.
- `GET /api/auth/google/callback` validates the ceremony and completes it.

Each ceremony creates a short-lived, one-time database transaction. The state and PKCE verifier are held in Secure-in-production, HttpOnly, SameSite=Lax cookies; only SHA-256 digests are persisted. Google receives `openid email` and an S256 PKCE challenge. The token exchange requests no refresh token. The provider boundary retains only the verified Google subject and verified email in process memory.

Callback state is consumed under a PostgreSQL row lock before provider work. Missing, mismatched, expired, reused, or concurrent callbacks cannot issue a session. Provider cancellation and provider failures clear ceremony cookies and redirect to a safe fixed local route with a generic status. Redirect targets are never accepted from query input.

## Account and linking semantics

- A verified Google identity already linked to an account signs into that account and rotates the presented session. A foreign presented session is revoked before a new account session is issued.
- A new Google identity with no matching Taskfella email creates a verified Google-only account and a rotated/new opaque session.
- A new Google identity whose verified email matches an existing Taskfella account is **not** silently linked and does not create a session. The user must sign in with the existing method and select **Link Google account** from `/account`.
- Privacy exception: after Google verifies control of an email, that Google-account holder may infer that a matching Taskfella account exists when this sign-in does not create a new account. This narrow inference is required to refuse silent linking and direct the user to the explicit-link step; failure wording and status remain generic, and no account identifier or other account data is disclosed.
- Explicit linking is bound to the account and session that started it. It may link a new verified Google identity once; a provider subject linked to another account is rejected, and a second Google identity on one account is reported as already linked without replacement.
- Email conflicts and identity conflicts leave the current account and session unchanged. Already-linked linking rotates the current session safely.
- The account API exposes only provider labels and link timestamps. Provider subjects, email responses beyond the app-owned account email, authorization codes, access tokens, refresh tokens, and raw session values are not exposed.

All callback responses use `cache-control: no-store` and `referrer-policy: no-referrer`. Session cookies remain HttpOnly, SameSite=Lax, and Secure in production. The existing CSRF and protected-route boundaries remain authoritative for app mutations.

## Verification

Run the standard checks after applying the migration:

```bash
pnpm db:migrate
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm test:integration
pnpm build
```

OAuth behavior tests use a mocked provider boundary and local placeholder configuration only. They do not contain credentials, authorization codes, access/refresh tokens, or raw session fixtures.

The disposable browser target used for this worktree closed before navigation, so no screenshot evidence was collected. The rendered authentication states were instead verified through the real Next.js route responses, response headers, callback redirects, and focused HTTP/HTML checks; this limitation is recorded here rather than treated as successful browser automation. The HTTP evidence included `GET /login` and `GET /signup` containing the Google action, no-cache/no-store response headers, the clear `503 OAUTH_NOT_CONFIGURED` local response, and the safe callback redirect to `/login?oauth=not-configured`.
