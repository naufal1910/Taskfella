# Phase 1B email/password authentication

Phase 1B implements the accessible email/password identity lifecycle on the Phase 1A foundation: signup, verification, login, current account, logout, forgot password, and reset password.

## Flow contract

- Passwords are passphrases of at least 12 characters and at most the Phase 1A 1024-character resource bound. Values are never trimmed or normalized.
- Login requires a verified email. Invalid credentials use one generic response; an unverified account receives only the instruction to verify before signing in.
- Signup, verification resend, and password reset requests use generic pending responses so an address cannot be confirmed by response content. Concurrent duplicate signup attempts are resolved by the database unique index.
- Verification and reset values are random one-time bearer values. Only SHA-256 digests are stored. Verification links expire after 24 hours; reset links expire after one hour. Resend and forgot-password issuance invalidate outstanding older links transactionally.
- Verification consumes the link and marks the account verified in one transaction. It does not silently create a session; the user signs in explicitly.
- Reset consumes the link, updates the Argon2id credential, revokes every account session, and clears the presented browser cookie.
- Cookie-authenticated mutations retain the Phase 1A origin and double-submit CSRF checks. Session cookies remain HttpOnly, SameSite=Lax, path-rooted, and Secure in production.

## Email delivery

`src/server/modules/auth/email-sender.ts` is the only transactional-email boundary. Non-production environments default to the local sender, which writes minimal plain-text and accessible HTML messages to `.local/mail/`. The directory is ignored by git, files are mode `0600`, filenames contain no address or token, and the message body is available only as a local test artifact. Remove it with `rm -rf .local/mail/` after inspection.

Production must set `EMAIL_DELIVERY_MODE=smtp`, `EMAIL_SMTP_HOST`, and `EMAIL_FROM`. SMTP port, TLS mode, and optional paired username/password are documented in `.env.example`; there is no production fallback to local capture. SMTP uses the portable Nodemailer SMTP transport rather than a provider-specific SDK.

Message links are derived from `APP_URL`. The message contains no unrelated personal content and states the one-time expiration time. Raw links are not logged or returned by API responses.

## Verification

Run `pnpm db:migrate` after pulling the Phase 1B migration, then use `pnpm dev` and the routes `/signup`, `/verify-email`, `/login`, `/account`, `/logout`, `/forgot-password`, and `/reset-password`. The API route handlers are under `src/app/api/auth/` and return `cache-control: no-store` responses. `GET /api/health` remains tied to the latest migration hash in `src/server/db/client.ts`.
