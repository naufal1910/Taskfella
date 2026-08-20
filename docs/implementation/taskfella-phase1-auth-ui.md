# Phase 1B Calm Execution authentication UI

The merged email/password lifecycle uses the Calm Execution visual contract from `DESIGN.md` across signup, verification and resend, login, account, logout, forgot-password, and reset-password.

Shared auth UI keeps the centered warm-paper card, Taskfella mark, canonical teal/ink/semantic palette, persistent labels, 44px controls, visible focus treatment, field-associated errors, live status/error regions, reduced-motion behavior, and mobile-safe action layout. One-time-link states remain generic and recoverable; no token value is rendered in UI copy.

## Verification record

- `pnpm test:unit` — pass (45 tests), including static accessibility/state coverage in `tests/unit/auth-ui.test.ts`.
- `pnpm typecheck` — pass.
- `pnpm lint` — pass.
- `pnpm format:check` — pass.
- `pnpm exec vitest run --no-file-parallelism` — pass (65 tests); serial execution avoids the repository's pre-existing concurrent PostgreSQL rate-limit test contention.
- Running-app HTTP/HTML checks — pass for all Phase 1B routes; rendered labels, ARIA references, loading state, missing-link recovery, and served mobile/reduced-motion CSS were verified without browser automation.
- `chrome-devtools-axi` was attempted for rendered visual verification, but the browser target closed before `snapshot` twice (`Target.setDiscoverTargets: Target closed`). No screenshot was available; verification proceeded with the HTTP/HTML and focused test evidence above.
