# Contributing to Taskfella

Thank you for helping build Taskfella. Phase 2 is the latest merged phase and Phase 3 task/board execution is under review; please check the [public roadmap](https://github.com/users/naufal1910/projects/4), [Phase 0 issue](https://github.com/naufal1910/Taskfella/issues/2), [Phase 1A issue](https://github.com/naufal1910/Taskfella/issues/13), [Phase 1B issue](https://github.com/naufal1910/Taskfella/issues/14), [Phase 1C issue](https://github.com/naufal1910/Taskfella/issues/15), [Phase 1D issue](https://github.com/naufal1910/Taskfella/issues/16), [Phase 1E issue](https://github.com/naufal1910/Taskfella/issues/17), [Phase 2 issue](https://github.com/naufal1910/Taskfella/issues/4), [Phase 3 issue](https://github.com/naufal1910/Taskfella/issues/5), [Calm Execution UI foundation issue](https://github.com/naufal1910/Taskfella/issues/19), [Phase 1A notes](docs/implementation/taskfella-phase1a-auth.md), [Phase 1B notes](docs/implementation/taskfella-phase1b-auth.md), [Phase 1C notes](docs/implementation/taskfella-phase1c-google-oauth.md), [Phase 1D notes](docs/implementation/taskfella-phase1d-settings.md), the [Phase 1E verification record](docs/implementation/taskfella-phase1e-verification.md), the [Phase 2 implementation record](docs/implementation/taskfella-phase2-projects-boards.md), and the [Phase 3 implementation record](docs/implementation/taskfella-phase3-tasks.md) before starting product work.

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

## Phase 1E authentication verification

The verified local workflow keeps `AUTH_TRUSTED_PROXY=false`, `EMAIL_DELIVERY_MODE=local`, and Google credentials unset. Use only local PostgreSQL, mode-0600 mail artifacts, mocked Google providers, and disposable test accounts. After migrating the database, run `pnpm db:check` before relying on readiness or integration results. With `pnpm dev` running, follow the [Phase 1E verification record](docs/implementation/taskfella-phase1e-verification.md) with `chrome-devtools-axi` at desktop and 390×844 viewports; do not use real external credentials.

When authentication, account settings, project/workflow, or task behavior changes, reconcile the user-facing README, [operations guide](docs/operations.md), `.env.example` when its contract changes, the relevant implementation note, [documentation index](docs/README.md), and this guide. Update the relevant Phase 1E, Phase 2, or Phase 3 evidence record when verified behavior changes.

## Visual foundation

`DESIGN.md` is the canonical visual contract for Taskfella. Validate changes to it with:

```bash
npx -y @google/design.md lint DESIGN.md
```

The command is intentionally run on demand rather than kept as a project dependency; it must report zero errors and zero warnings.

## Before opening a pull request

Run the repository checks locally:

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm db:migrate
pnpm db:check
pnpm test
pnpm build
```

Database integration tests need a reachable, migrated PostgreSQL instance. Keep changes focused, add behavior-level tests for new public interfaces, and preserve the modular-monolith boundary.

## Architecture pointers

- `src/app/` contains the Next.js App Router UI and route handlers.
- `src/server/` contains configuration, HTTP foundations, observability, database access, and domain-ready server modules.
- `drizzle/` contains ordered migrations; the latest required migration is part of readiness. Phase 2 workflow triggers/indexes remain in `0007`/`0008`; Phase 3 task tables and ownership/order indexes are in the new `0009` migration only. Do not rewrite earlier ancestry.
- `compose.yaml` is only for local PostgreSQL development.
- `docs/implementation/taskfella-analysis.md` is the authoritative phased implementation plan.

Avoid introducing services, queues, caches, or other deployment infrastructure before the product requirements and measured needs justify them.

## Pull requests

Use a descriptive branch, explain the user-facing or operational outcome, list validation commands, and link the relevant issue. Keep secrets and machine-local files out of the patch.
