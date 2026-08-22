# Project agent memory

This file is the project's committed home for project-intrinsic agent knowledge: build, test, release, architecture, and sharp-edge notes that should travel with the code.

- Add durable project-specific notes here as they are discovered through real work.

## Foundation pointers

- `README.md` is the contributor quick start and command reference.
- `DESIGN.md` is the canonical visual contract; its validator command and zero-error/zero-warning requirement are documented in `CONTRIBUTING.md`.
- `docs/implementation/taskfella-analysis.md` is the approved phased implementation plan; the `docs/implementation/taskfella-phase1*.md`, `docs/implementation/taskfella-phase2-projects-boards.md`, and `docs/implementation/taskfella-phase3-tasks.md` records preserve authentication, OAuth/linking, account-settings security, workflow, task-boundary, and integrated verification decisions.
- `src/server/db/schema.ts` and ordered `drizzle/` migrations are the source of truth for authentication, OAuth-ceremony, account-settings, Phase 2 project/workflow tables, and Phase 3 task data; Phase 2/3 domain behavior lives in `src/server/modules/projects/service.ts`, `src/server/modules/workflow/wip.ts`, and `src/server/modules/tasks/service.ts`. Markdown storage/rendering is bounded by `src/server/modules/tasks/markdown.ts`.
- `GET /api/health` is the executable readiness contract; `pnpm db:migrate` must run before a healthy response is expected, including after a new migration.
- Keep the application as a modular monolith. Do not add services, queues, caches, or deployment layers for later-phase behavior. The current Phase 3 slice stops at task planning/board execution; focus, time tracking, analytics, exports, and collaboration remain later phases.

## Maintaining this file

Keep this file for knowledge useful to almost every future agent session in this project.
Do not repeat what the codebase already shows; point to the authoritative file or command instead.
Prefer rewriting or pruning existing entries over appending new ones.
When updating this file, preserve this bar for all agents and keep entries concise.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
