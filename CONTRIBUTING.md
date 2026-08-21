# Contributing to Taskfella

Thank you for helping build Taskfella. Phase 1C includes Google OAuth and explicit identity linking, and Phase 1D adds account settings and appearance on the Phase 1A/1B/1C authentication foundation; please check the [public roadmap](https://github.com/users/naufal1910/projects/4), [Phase 0 issue](https://github.com/naufal1910/Taskfella/issues/2), [Phase 1A issue](https://github.com/naufal1910/Taskfella/issues/13), [Phase 1B issue](https://github.com/naufal1910/Taskfella/issues/14), [Phase 1C issue](https://github.com/naufal1910/Taskfella/issues/15), [Phase 1D issue](https://github.com/naufal1910/Taskfella/issues/16), [Calm Execution UI foundation issue](https://github.com/naufal1910/Taskfella/issues/19), [Phase 1A notes](docs/implementation/taskfella-phase1a-auth.md), [Phase 1B notes](docs/implementation/taskfella-phase1b-auth.md), [Phase 1C notes](docs/implementation/taskfella-phase1c-google-oauth.md), and [Phase 1D notes](docs/implementation/taskfella-phase1d-settings.md) before starting product work.

## Development setup

Use Node.js 20.9 or newer, pnpm 11 or newer, and Docker Compose.

```bash
cp .env.example .env
pnpm install --frozen-lockfile
docker compose up -d --wait db
pnpm db:migrate
pnpm dev
```

Do not put real credentials in `.env.example`, source files, tests, commits, or pull requests. `.env` is ignored and local PostgreSQL values are development-only placeholders. See the [foundation operations guide](docs/operations.md) for local transactional-message capture and production delivery guidance.

## Visual foundation

`DESIGN.md` is the canonical visual contract for Taskfella. Validate changes to it with:

```bash
npx -y @google/design.md lint DESIGN.md
```

The command is intentionally run on demand rather than kept as a project dependency; it must report zero errors and zero warnings.

## Before opening a pull request

Run the same checks as CI:

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm db:migrate
pnpm test
pnpm build
```

Database integration tests need a reachable, migrated PostgreSQL instance. Keep changes focused, add behavior-level tests for new public interfaces, and preserve the modular-monolith boundary.

## Architecture pointers

- `src/app/` contains the Next.js App Router UI and route handlers.
- `src/server/` contains configuration, HTTP foundations, observability, database access, and domain-ready server modules.
- `drizzle/` contains ordered migrations; the latest required migration is part of readiness.
- `compose.yaml` is only for local PostgreSQL development.
- `docs/implementation/taskfella-analysis.md` is the authoritative phased implementation plan.

Avoid introducing services, queues, caches, or other deployment infrastructure before the product requirements and measured needs justify them.

## Pull requests

Use a descriptive branch, explain the user-facing or operational outcome, list validation commands, and link the relevant issue. Keep secrets and machine-local files out of the patch.
