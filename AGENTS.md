# Project agent memory

This file is the project's committed home for project-intrinsic agent knowledge: build, test, release, architecture, and sharp-edge notes that should travel with the code.

- Add durable project-specific notes here as they are discovered through real work.

## Foundation pointers

- `README.md` is the contributor quick start and command reference.
- `docs/implementation/taskfella-analysis.md` is the approved phased implementation plan; `docs/implementation/taskfella-phase1a-auth.md` records the authentication-foundation security decisions.
- `src/server/db/schema.ts` and ordered `drizzle/` migrations are the source of truth for Phase 1A authentication tables.
- `GET /api/health` is the executable readiness contract; `pnpm db:migrate` must run before a healthy response is expected, including after a new migration.
- Keep the application as a modular monolith. Do not add services, queues, caches, or deployment layers for later-phase behavior during foundation work.

## Maintaining this file

Keep this file for knowledge useful to almost every future agent session in this project.
Do not repeat what the codebase already shows; point to the authoritative file or command instead.
Prefer rewriting or pruning existing entries over appending new ones.
When updating this file, preserve this bar for all agents and keep entries concise.
