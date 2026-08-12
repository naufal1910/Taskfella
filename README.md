# Taskfella

Taskfella is an open-source, personal-first, board-first workspace for focused execution. It will bring Kanban planning, Pomodoro focus, manual time tracking, and personal analytics into one calm daily workflow.

This repository currently contains **Phase 0 plus Phase 1A: the application and authentication foundation**. It intentionally does not implement signup/login pages, email delivery, Google OAuth routes, boards, tasks, timers, analytics, exports, or other later-phase product behavior.

## Quick start

Prerequisites: Node.js 20.9+, pnpm 11+, and Docker with Compose.

```bash
git clone https://github.com/naufal1910/Taskfella.git
cd Taskfella
cp .env.example .env
pnpm install --frozen-lockfile
docker compose up -d --wait db
pnpm db:migrate
pnpm dev
```

Open <http://localhost:3000>. Check database and application readiness with:

```bash
curl -i http://localhost:3000/api/health
```

A migrated, reachable database returns HTTP `200` with `status: "ok"`. An unavailable or unmigrated database returns HTTP `503` with a safe `status: "degraded"` response; credentials and internal errors are never returned.

## Commands

| Command                          | Purpose                                                          |
| -------------------------------- | ---------------------------------------------------------------- |
| `pnpm install --frozen-lockfile` | Install the pinned dependency graph                              |
| `docker compose up -d --wait db` | Start local PostgreSQL and wait for its healthcheck              |
| `pnpm db:migrate`                | Apply repeatable Drizzle migrations                              |
| `pnpm db:check`                  | Verify PostgreSQL reachability and migration readiness           |
| `pnpm dev`                       | Start the development server                                     |
| `pnpm lint`                      | Run ESLint                                                       |
| `pnpm format:check`              | Check Prettier formatting                                        |
| `pnpm typecheck`                 | Run strict TypeScript checking                                   |
| `pnpm test`                      | Run unit, smoke, and available integration tests                 |
| `pnpm test:integration`          | Require a migrated database, then run database integration tests |
| `pnpm build`                     | Create the production build                                      |
| `pnpm start`                     | Serve the production build                                       |
| `pnpm db:stop`                   | Stop local PostgreSQL                                            |

The full local quality pass is `pnpm validate`. Database-backed tests require the local database to be running and migrated. Compose exposes PostgreSQL on host port `5433` so it can coexist with other local projects; `.env.example` matches that port. Phase 1A uses database-backed opaque random tokens and needs no external or private authentication secret.

## Production container

Build and run the standalone production image with values supplied at runtime:

```bash
docker build -t taskfella:local .
docker run --rm -p 3000:3000 \
  -e DATABASE_URL='postgresql://user:password@host:5432/taskfella' \
  -e APP_URL='http://localhost:3000' \
  taskfella:local
```

Run `pnpm db:migrate` as a deployment step against the target database before starting the application container. The image starts the Next.js standalone server and does not contain development credentials.

## Project documents

- [Canonical visual design contract](DESIGN.md)

The design contract can be checked without adding a project dependency:

```bash
npx -y @google/design.md lint DESIGN.md
```

The validator must report zero errors and zero warnings.

- [Approved product specification](docs/specification/taskfella-mvp-design.md)
- [Approved implementation analysis and phased plan](docs/implementation/taskfella-analysis.md)
- [Phase 0 and Phase 1A documentation index](docs/README.md)
- [Phase 1A authentication foundation](docs/implementation/taskfella-phase1a-auth.md)
- [Public roadmap](https://github.com/users/naufal1910/projects/4)
- [Phase 0 issue](https://github.com/naufal1910/Taskfella/issues/2)
- [Phase 1A issue](https://github.com/naufal1910/Taskfella/issues/13)
- [Calm Execution UI foundation issue](https://github.com/naufal1910/Taskfella/issues/19)

## License

Taskfella is released under the [MIT License](LICENSE). See the [license assessment](docs/license-assessment.md) for the Phase 0 licensing decision.
