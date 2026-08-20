# Phase 1D account settings and appearance

Phase 1D adds the authenticated account-preferences boundary on the Phase 1A/1B session foundation. It does not add OAuth, boards, timers, or data-lifecycle behavior.

## Account settings contract

`GET /api/account` returns the authenticated account's profile and settings. `PATCH /api/account` is the cookie-authenticated mutation boundary; `PUT` is an idempotent compatibility alias. `/api/account/settings` exposes the same handlers for clients that use a settings-specific resource name.

The persisted fields are:

- optional display name (maximum 80 characters);
- account timezone (an `Intl`/IANA-supported identifier, defaulting to `UTC` when no browser value is supplied);
- `system`, `light`, or `dark` appearance (default `system`);
- focus and break notifications on/off (default on);
- timer sound on/off (default on);
- focus duration in minutes: 1–120;
- short-break duration in minutes: 1–60;
- long-break duration in minutes: 1–120;
- long-break interval: 1–12 completed focus sessions.

The database checks the appearance and Pomodoro bounds. The route validates all input types, display-name controls, and timezone identifiers before any update. Updates are scoped to the account resolved from the opaque session; a client account ID is not accepted as an authorization input. Responses are `no-store`, mutation requests require the existing same-origin and double-submit CSRF checks, and invalid input uses the safe generic `INVALID_REQUEST` response.

Each PATCH changes only the supplied fields and uses one database update, so concurrent updates to separate settings do not overwrite an unrelated field. Settings affect new focus sessions only; a future timer implementation must snapshot values when a session starts.

## Timezone initialization

The browser submits its detected `Intl.DateTimeFormat().resolvedOptions().timeZone` during signup when available. The settings screen also displays a detected browser timezone as an explicit suggestion. A persisted account timezone always wins; detection never silently overwrites an existing saved value. `UTC` is the server fallback for accounts created without a browser value.

Exact event timestamps remain UTC. The account timezone is the later reporting/display boundary for local-day behavior.

## Appearance behavior

The server sets a non-sensitive `taskfella_appearance` cache cookie after login and account reads, and clears it on logout/password reset. Successful settings mutations return an account revision; the settings client updates the cache only after confirming that revision is current. It is not an authorization or source-of-truth value; PostgreSQL remains authoritative. The root layout runs a small pre-paint bootstrap that resolves `system` through `prefers-color-scheme`, and a client controller follows later system-preference changes. Explicit theme selectors override the system media query without a hydration-dependent flash. The existing reduced-motion and forced-colors rules remain active.

If the cache is absent or invalid, the browser falls back to its system preference and the authenticated account read restores the persisted choice.

## Verification

After pulling the migration, run:

```bash
pnpm db:migrate
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm test:integration
pnpm build
```

The integration settings coverage exercises the PostgreSQL migration and route handlers for authentication, persistence, validation, isolation, CSRF, no-cache responses, and concurrent field updates.
