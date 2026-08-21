# Phase 1E integrated authentication verification

Phase 1E verifies the merged Phase 1A–1D account experience as one local, credential-free workflow. The application remains a modular monolith: PostgreSQL, local transactional-message capture, and mocked Google provider responses are the only dependencies required for automated verification.

## Reproducible local verification

```bash
cp .env.example .env
pnpm install --frozen-lockfile
docker compose up -d --wait db
pnpm db:migrate
pnpm db:check
pnpm validate
pnpm test:integration
pnpm build
pnpm dev
```

`AUTH_TRUSTED_PROXY=false` remains the safe direct-development setting. The Next development proxy marks its own forwarding metadata so browser mutations use the bounded local rate-limit bucket without trusting a client-supplied address. Production still requires `AUTH_TRUSTED_PROXY=true` behind a proxy that strips and sets the client address.

Authentication messages use `EMAIL_DELIVERY_MODE=local` and write mode-`0600` JSON artifacts below the ignored `.local/mail/` directory. No SMTP or Google credential is needed locally. Google sign-in without both variables redirects a browser to `/login?oauth=not-configured`; the automated configured-path tests use an in-process mocked provider and placeholder values only.

## End-to-end evidence

Using `chrome-devtools-axi` against the migrated local app at desktop and 390×844 viewports verified:

- signup through the local verification message, fragment-based verification, login, account read, logout, and returning-session behavior;
- password-reset request, fragment-based reset, session invalidation, new-password login, and one-time-link replay behavior;
- switching from one verified local account to another without showing the first account's content;
- account settings for display name, strict IANA timezone validation, System/Light/Dark appearance, notifications, sound, and Pomodoro values, including persistence after navigation and reload;
- keyboard-only form submission, visible focus, field-associated errors, live pending/success/error announcements, and touch-sized mobile controls;
- the Google action's clear no-credential local state and the explicit account-linking ceremony through mocked provider callbacks.

The root pre-paint bootstrap was checked for authenticated preference authority and no-flash System/Light/Dark transitions. Logout, login, account-switch, and password-reset transitions replace the appearance epoch and reject stale client responses. Immediate live synchronization between independent windows remains intentionally out of scope; navigation and reload synchronization are covered.

## Security and leakage evidence

The executable unit and PostgreSQL integration suites cover:

- opaque session rotation, revocation, expiry, foreign-session replacement, and password-reset account-wide invalidation;
- same-origin plus double-submit CSRF rejection, bounded concurrent rate limits, trusted-proxy handling, and normalized-email ownership;
- verification/reset expiry, supersession, replay, and concurrent single-use consumption;
- OAuth state, PKCE verifier, cancellation, provider failure, replay, tampering, session binding, identity conflicts, email conflicts, and already-linked behavior;
- authenticated account scoping and cross-account settings isolation;
- stale appearance snapshots and lifecycle epochs.

One-time email values are now URL fragments. They are consumed by the client and sent only in the existing CSRF-protected POST, keeping them out of server request URLs, referrers, generated server HTML, and application logs. The generated public browser chunks contain no provider secret, SMTP credential, password, bearer token, or OAuth access token. The session cookie is HttpOnly; readable browser storage contains only the CSRF token and non-sensitive appearance metadata. Structured logs use a technical allow-list and never include request bodies, personal content, credentials, or exception details.

`public/robots.txt` was removed because it conflicted with the canonical `src/app/robots.ts` metadata route and returned HTTP 500 in the development server.

## Required checks

The final gate runs the repository's full relevant checks: formatting, ESLint, strict TypeScript, unit/smoke/integration Vitest suites, PostgreSQL migration/readiness, and the production build. Browser accessibility was additionally checked with Lighthouse; authentication/settings pages reached 100 accessibility and 100 best-practices scores in the local browser session.

Production setup must replace the placeholders in `.env.example` with real, runtime-only SMTP and Google Web application credentials. Register `/api/auth/google/callback` with the deployed HTTPS `APP_URL` origin. Never commit or print those values.
