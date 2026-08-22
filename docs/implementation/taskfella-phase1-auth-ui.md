# Phase 1B Calm Execution authentication UI

The merged email/password lifecycle uses the Calm Execution visual contract from `DESIGN.md` across signup, verification and resend, login, account, logout, forgot-password, and reset-password.

Shared auth UI keeps the centered warm-paper card, Taskfella mark, canonical teal/ink/semantic palette, persistent labels, 44px controls, visible focus treatment, field-associated errors, live status/error regions, reduced-motion behavior, and mobile-safe action layout. One-time-link states remain generic and recoverable; no token value is rendered in UI copy.

## Verification record

- `pnpm test:unit` — pass, including static accessibility/state coverage in `tests/unit/auth-ui.test.ts`.
- `pnpm typecheck` — pass.
- `pnpm lint` — pass.
- `pnpm format:check` — pass.
- `pnpm exec vitest run --no-file-parallelism` — pass; the Vitest configuration serializes file execution so concurrent PostgreSQL integration fixtures cannot contend with fixed-time rate-limit cases.
- Running-app HTTP/HTML checks — pass for all Phase 1B routes; rendered labels, ARIA references, loading state, missing-link recovery, and served mobile/reduced-motion CSS are covered by the integrated [Phase 1E verification record](taskfella-phase1e-verification.md).
