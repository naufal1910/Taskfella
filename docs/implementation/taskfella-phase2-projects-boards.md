# Phase 2 projects, boards, workflow, and WIP

Phase 2 delivers the account-owned board foundation from [issue #4](https://github.com/naufal1910/Taskfella/issues/4) on top of the complete Phase 1 authentication and account boundary.

## Product boundary

A project is the board in this phase. It has an owner account, name, constrained description, active/archived lifecycle, stable order, a revision for optimistic concurrency, and retained lifecycle events. Archive and restore never remove workflow data. Permanent deletion is a separate destructive action and requires the exact project name in the request; the UI requires the same typed confirmation before enabling the final button.

Project creation supports:

- **Personal Project:** `Backlog` (queued), `Today` (planned), `In Progress` (active), `Review` (review), `Done` (completed);
- **Simple:** `To Do` (queued), `In Progress` (active), `Done` (completed);
- **Blank:** a minimal valid `In Progress` (active) and `Done` (completed) foundation, ready for manual customization.

Every template is valid at commit time. The Phase 2 board intentionally contains no task execution surface. The empty-column and WIP transaction hooks are the workflow boundary that Phase 3 task movement will use rather than a speculative task model.

## Persistence and invariants

The ordered `0007_known_earthquake` and `0008_absent_warbird` migrations add:

- `projects` with owner, lifecycle, position, revision, archive timestamp, and indexes;
- `columns` with position, role, WIP mode/limit, completed grouping, checks, and a partial unique index for one active column;
- `swimlanes` with account-owned-through-project parentage and independent ordering;
- `labels` with board parentage, deterministic normalized-name uniqueness, color validation, and ordering;
- `project_lifecycle_events` for retained create/archive/restore history;
- a deferred PostgreSQL constraint trigger that checks exactly one active column and at least one completed column at transaction commit, including project insertion and concurrent raw writes;
- a composite project-owner foreign key for lifecycle events and a lowercase normalized-label check.

The application serializes project workflow changes with a PostgreSQL advisory transaction lock plus a row lock. Revision preconditions turn stale client edits into `CONCURRENT_UPDATE` conflicts, including swimlane and label mutations. Role changes crossing the completed boundary require `confirmCompletionChanges`; invalid final role sets are rejected before any update is committed. Column deletion is permitted only for an empty Phase 2 workflow column and is still checked against the role invariants. The project-scoped column `DELETE` route accepts an empty body; when JSON is supplied, it may carry revision options, while malformed JSON remains invalid.

The workflow editor keeps its mounted local draft while add/delete responses update the saved project snapshot, preserving unsaved edits and surfacing concurrent revision conflicts instead of discarding them.

`src/server/modules/workflow/wip.ts` owns the WIP policy. `none` always allows, `warn` requires an explicit confirmation retry when the authoritative count is at the limit, and `enforce` rejects overflow. `assertColumnWip` runs both the authoritative count reader and the future task mutation inside the project-locked transaction, so a stale browser count or concurrent move cannot bypass WIP. No client-only WIP warning is treated as authoritative.

## API surface

All project routes are cookie-session authenticated and mutation routes retain the Phase 1 CSRF boundary:

- `GET/POST /api/projects`;
- `GET/PATCH/DELETE /api/projects/:projectId`;
- `POST /api/projects/:projectId/archive`, `/restore` (also `/reopen`), and `/permanent-delete`;
- workflow configuration and column routes under `/api/projects/:projectId/workflow` and `/columns`;
- project order, swimlane, and board-label routes under `/api/projects`;
- compatibility item routes under `/api/columns`, `/api/swimlanes`, and `/api/labels`.

Responses use safe error codes such as `BOARD_INVARIANT_VIOLATION`, `WORKFLOW_CONFIRMATION_REQUIRED`, `WIP_CONFIRMATION_REQUIRED`, `WIP_LIMIT_REACHED`, `CONCURRENT_UPDATE`, and `PERMANENT_DELETE_CONFIRMATION_REQUIRED`.

## Responsive board foundation

`/projects` provides accessible active and archived project sections, template creation, project ordering/lifecycle controls, and typed permanent-delete confirmation. `/projects/:projectId` provides the board-first surface, semantic role and WIP configuration, column reorder/add/delete controls, optional swimlane and board-label creation, retained lifecycle history, and archive/restore actions.

Desktop/tablet uses the canonical warm-paper/sidebar/multi-column layout. Small screens hide the sidebar, expose bottom navigation, select one workflow column at a time, and retain all configuration controls with 44px touch targets. Empty board content explicitly identifies the later Phase 3 task boundary; no drag gesture is required for any Phase 2 state change.

## Verification

With local PostgreSQL running:

```bash
pnpm db:migrate
pnpm db:check
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm test:integration
pnpm build
```

Executable coverage includes template validity, account isolation, project and workflow mutation routes, workflow ordering and configuration, role confirmation, WIP modes, malformed and bodyless column-delete parsing, deferred database invariant rejection, concurrent revision serialization, archive/restore retention, explicit destructive deletion, and migration/readiness behavior. External browser/accessibility evidence covers desktop and 390px mobile dimensions using local fixtures only: on 2026-08-22, `chrome-devtools-axi` verified the authenticated project list and board, including desktop multi-column navigation, mobile one-column selection, bottom navigation, typed destructive confirmation, workflow dialog semantics, and visible focus/labels. Lighthouse reported Accessibility 100, Best Practices 100, and SEO 100 for the local project list.

The PR for this record carries `Closes #4`. Parent roadmap issue #1 remains open for later task, focus, analytics, export, and collaboration phases.
