# Contributing to Taskfella

Thank you for helping build Taskfella. Phase 0 is intentionally foundation-only; please check the [public roadmap](https://github.com/users/naufal1910/projects/4) and [Phase 0 issue](https://github.com/naufal1910/Taskfella/issues/2) before starting product work.

## Development setup

Use Node.js 20.9 or newer, pnpm 11 or newer, and Docker Compose.

```bash
cp .env.example .env
pnpm install --frozen-lockfile
docker compose up -d db
pnpm db:migrate
pnpm dev
```

Do not put real credentials in `.env.example`, source files, tests, commits, or pull requests. `.env` is ignored and local PostgreSQL values are development-only placeholders.

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
- `drizzle/` contains ordered migrations; Phase 0 intentionally has no product tables.
- `compose.yaml` is only for local PostgreSQL development.
- `docs/implementation/taskfella-analysis.md` is the authoritative phased implementation plan.

Avoid introducing services, queues, caches, or other deployment infrastructure before the product requirements and measured needs justify them.

## Pull requests

Use a descriptive branch, explain the user-facing or operational outcome, list validation commands, and link the relevant issue. Keep secrets and machine-local files out of the patch.
