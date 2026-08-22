# Phase 3 tasks and board execution

Phase 3 delivers the account-owned task planning and board-execution slice from [issue #5](https://github.com/naufal1910/Taskfella/issues/5). The issue remains open until the captain-approved PR merges; this record is implementation and verification evidence, not a delivery declaration.

## Product boundary

The project board now supports fast capture and complete task planning without making drag-and-drop a prerequisite. Quick creation keeps its input focused for repeated entry, while **Add details** opens the task detail panel. Desktop uses a right-side detail panel; small screens use a full-screen detail surface with the same fields and actions.

Task state is defined by the destination column's Phase 2 semantic role. Moving into any `completed` column sets `completed_at`; leaving one clears it. Moving between completed columns preserves completion. All meaningful transitions retain task lifecycle events. Phase 2 `none`, `warn`, and `enforce` WIP policies are re-evaluated inside the same PostgreSQL transaction as task movement, creation, and restore, under the existing project advisory/row lock.

Drag-and-drop is available for desktop board movement, but every state-changing path also has explicit **Move to…**, position arrows, task details controls, keyboard shortcuts, and mobile controls. `N` focuses quick entry, `/` focuses search, and `Escape` closes task details and returns focus to the triggering control. Browser back also closes an open detail surface without leaving the board.

## Persistence and trust boundaries

Migration `0009_clammy_miss_america.sql` is the only new Phase 3 migration artifact. It adds:

- account/project/column/swimlane-scoped `tasks` with date-only due dates, visual color, ordering, completion, revision, Trash state, and restoration metadata;
- composite ownership and parentage constraints for task locations;
- constrained `task_labels` joins that cannot cross accounts or projects;
- ordered `subtasks`, chronological `notes`, and retained `task_lifecycle_events`;
- indexes for board order, due dates, ownership, search-related lookups, and active task positions.

`src/server/modules/tasks/markdown.ts` is the Markdown trust boundary. Storage normalization strips raw HTML/comments, removes images, and turns unsafe URL destinations into plain text. Rendering escapes all user text and only generates the supported headings, emphasis, lists, code, and safe `http`, `https`, `mailto`, relative, and fragment links. No user HTML, event handler, script, `javascript:`, `vbscript:`, or `data:` URL is passed to the browser.

Every task, child record, label join, search/filter query, movement, ordering change, restore, Trash action, and permanent deletion operation is scoped through the authenticated account and validated again in the domain service. Permanent task deletion requires the exact task title and is only available from Trash; ordinary deletion is reversible.

Trash retains notes, subtasks, labels, lifecycle history, and task identity. Restore first attempts the saved column, swimlane, and position; if a parent was removed it falls back to the first non-completed column and no swimlane. Archived projects remain archived during restore. Removing a workflow column or swimlane updates only hidden/current foreign-key locations while retaining restoration metadata.

## API surface

Primary project-scoped routes:

- `GET/POST /api/projects/:projectId/tasks`
- `GET/PATCH/DELETE /api/projects/:projectId/tasks/:taskId`
- `POST /api/projects/:projectId/tasks/:taskId/move`
- `POST /api/projects/:projectId/tasks/:taskId/restore`
- `POST /api/projects/:projectId/tasks/:taskId/permanent-delete`
- `POST /api/projects/:projectId/tasks/:taskId/subtasks` and `PATCH/DELETE .../:subtaskId`
- `POST /api/projects/:projectId/tasks/:taskId/notes` and `PATCH/DELETE .../:noteId`

Compatibility task routes under `/api/tasks/:taskId` expose the same authenticated service operations. Search and combinable filters are query parameters on the list route: `search`, `labelId`, `color`, `due`, `columnId`, `swimlaneId`, and `trash`. Date-only due filters use the account timezone, not the server's local timezone.

## Executable verification

The task integration suite covers:

- ownership isolation and composite task-label constraints;
- title/description/label/color/date creation, subtasks, notes, and search across all approved text fields;
- `none`, `warn`, and `enforce` WIP behavior, including concurrent PostgreSQL movement serialization and no partial moves;
- persisted per-location ordering and reorder compaction;
- completion/reopening by destination role and completion-role reconciliation;
- lifecycle events, Trash metadata, deleted-column fallback, restore, exact-title permanent deletion, and cascade cleanup;
- authenticated list/detail routes plus malformed and foreign IDs.

Markdown unit coverage proves both sanitized storage and escaped/generated rendering behavior. Existing Phase 1/2 tests remain in the full suite. Migration/readiness is checked through the required latest migration hash.

With local PostgreSQL running, the reproducible checks are:

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

## Local browser evidence

Using `chrome-devtools-axi` with a local fixture account and migrated local PostgreSQL verified:

- authenticated board load and project creation through the local UI;
- focused quick-create entry with keyboard `Enter`;
- task card rendering, explicit Move to selection, and destination-column movement;
- desktop task detail dialog semantics, screen-reader context, visible close control, `Escape` focus restoration, and browser-history close behavior;
- 390×844 mobile layout with bottom navigation, one-column selector, explicit swimlane capture, and touch-sized task controls;
- Lighthouse accessibility 100, best practices 100, SEO 100, and agentic browsing 100 on the local task board after fixing list semantics and form-control naming;
- no browser console errors during the board/detail/mobile pass.

No real credentials, external providers, or generated Stitch code were used. Focus timers, time tracking, analytics, exports, collaboration, and all other Phase 4 or later behavior remain outside this change.
