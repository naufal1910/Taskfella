# Taskfella MVP Analysis and Implementation Plan

**Date:** 2026-08-09

**Status:** Historical analysis complete; the foundation through Phase 2 is merged and the Phase 3 task/board-execution implementation is under review.

This document began as a pre-foundation analysis. Its repository-comparison sections describe that historical baseline; current implementation truth is `src/server/db/schema.ts`, ordered `drizzle/` migrations, the Phase 2 and Phase 3 implementation records, and the executable commands in `README.md`.

## 1. Executive conclusion

Taskfella is a personal-first project execution application combining a customizable Kanban board, Pomodoro focus, manual time tracking, and personal focus analytics.

The PRD defines a complete and coherent MVP centered on a trustworthy daily execution loop.

The historical repository snapshot was firstmate, an agent-orchestration distro, not a Taskfella application. The current checkout is the Taskfella application described by the later phase records.

The historical repository snapshot had no frontend, backend, database schema, migrations, application package configuration, or browser test suite for Taskfella.

Taskfella should be created as a separate application repository.

The approved repository settings are:

- Repository: `naufal1910/Taskfella`
- Visibility: private
- Delivery posture: `no-mistakes-prod-only`
- Autonomy: yolo disabled
- Recommended stack: TypeScript, React, Next.js, PostgreSQL

No GitHub repository, local application copy, dependencies, or application code has been created yet.

## 2. Work completed before implementation

The complete 1,428-line PRD was read from disk in bounded sections.

The repository root was inspected.

`README.md`, `CONTRIBUTING.md`, `.github/workflows/ci.yml`, and `.gitignore` were inspected.

Application manifests and source patterns were searched for across the repository.

The development environment was checked.

The PRD was compared with the repository contents.

The product requirements, data model, architecture, risks, ambiguities, and phased implementation plan were documented.

The exact GitHub repository owner was checked as `naufal1910`.

The captain explicitly approved the exact new repository settings listed above.

## 3. Current repository comparison

### Repository identity

The current repository README describes firstmate as an agent distro that supervises coding workers and manages project work.

The current contributing guide describes Bash scripts, ShellCheck, no-mistakes validation, and shell tests.

The current CI workflow lints shell scripts and runs Bash behavior tests.

### Taskfella implementation evidence

No `package.json` exists.

No `src/`, `app/`, `server/`, or `api/` application directory exists.

No frontend framework configuration exists.

No backend framework configuration exists.

No database schema or migration directory exists.

No Docker application setup exists.

No browser or end-to-end application test suite exists.

The repository contains approximately 128 Bash tools and 132 Bash tests for firstmate behavior.

The only Taskfella-specific artifact is `Taskfella-mvp-design.md`.

The PRD file is currently untracked.

### Environment evidence

Node.js version: `v22.23.1`.

npm version: `10.9.8`.

pnpm version: `11.17.0`.

Python version: `3.12.3`.

Docker version: `28.5.1`.

Git version: `2.43.0`.

GitHub CLI version: `2.96.0`.

tmux version: `3.4`.

Bun is unavailable.

The `sqlite3` command-line tool is unavailable.

The `psql` command-line tool is unavailable.

Docker is available for local PostgreSQL development.

## 4. Product understanding

### Product goal

Taskfella provides one coherent workflow for planning personal projects, selecting work, focusing, recording actual effort, finishing tasks, and reviewing personal focus behavior.

The primary success criterion is personal daily-use success.

A user should be able to rely on Taskfella instead of using one Kanban application and a separate Pomodoro or time-tracking application.

### Target users

The target user is an individual managing personal projects.

The target user is a recurring daily user rather than an occasional guest.

The target user may work from desktop, tablet, or mobile browsers.

The target user may have multiple browser tabs or devices open for the same account.

MVP does not include collaboration, sharing, assignees, roles, or team conversation.

The data model remains personal-first while retaining explicit ownership and parent identifiers for future collaboration.

### Core daily loop

```text
Create or open project
  -> create tasks
  -> organize board
  -> choose task
  -> start focus
  -> pause and resume if interrupted
  -> stop or complete focus
  -> add manual time if needed
  -> move task through workflow
  -> complete task
  -> review today's analytics
  -> return later and continue
```

The board is the primary work surface inside a project.

Home is the authenticated launchpad rather than a second task-management interface.

Focus behavior is part of board execution rather than a disconnected timer utility.

## 5. MVP functional scope

### Authentication and account

- Email/password signup and login.
- Google sign-in.
- Logout.
- Email verification.
- Password reset.
- Secure account sessions.
- Account settings.
- Account timezone.
- System, light, and dark appearance preferences.
- Pomodoro duration and sound preferences.
- Notification preferences.
- Account deletion with destructive confirmation and appropriate reauthentication.

### Projects and boards

- Board equals project for MVP.
- Project creation using Personal Project, Simple, or Blank templates.
- Optional project description using constrained sanitized Markdown.
- Project ordering.
- Active, archived, and permanently deleted project lifecycle states.
- Reversible archive and restore.
- Explicit permanent deletion confirmation.
- Archived projects excluded from Home actionable lists.
- Archived projects retained in historical analytics.

### Workflow configuration

- Custom columns.
- Column creation, renaming, reordering, configuration, and deletion.
- Semantic roles of `queued`, `planned`, `active`, `review`, `completed`, and `neutral`.
- Exactly one active column per board.
- At least one completed column per board.
- Multiple completed columns allowed.
- Confirmation when role changes alter task completion state.
- Column-level WIP modes of none, warn, and enforce.
- WIP counts all non-trashed tasks regardless of filters or swimlanes.
- Optional user-defined swimlanes.
- Persistent ordering for projects, columns, swimlanes, tasks, and subtasks.

### Tasks

- Plain-text task titles.
- Constrained sanitized Markdown descriptions.
- Current column.
- Optional swimlane.
- Board-specific labels.
- Purely visual color.
- Date-only due dates.
- Subtasks.
- Chronological personal notes.
- Time and focus history.
- Created and updated timestamps.
- Current completion timestamp.
- Quick creation with batch-entry behavior.
- Add-details creation flow.
- Desktop side-panel task details.
- Mobile full-screen task details or sheet.
- Search across title, description, subtasks, and notes.
- Filters for search, label, color, due-date state, column, and swimlane.
- Completion by moving to a completed column.
- Reopening by moving to a non-completed column.
- Soft delete to Trash.
- Restore with best-effort previous location.
- Permanent task deletion.
- Historical completion and reopening lifecycle events.

### Focus and time

- Pomodoro or timer-based focus.
- Manual time entry.
- No generic stopwatch mode.
- One unfinished focus session per account.
- Server-side enforcement across tabs and devices.
- Start Focus from task cards, task details, Home, and equivalent task contexts.
- Automatic move to the active column when needed.
- WIP enforcement during Start Focus.
- Target duration is not a hard stop.
- Exactly one completed Pomodoro when the target is first reached.
- Overtime continues after the target.
- Pause and resume.
- Interruption reason selection.
- Skip records an uncategorized interruption.
- Stop focus.
- Start short or long break.
- Break completion notification.
- No automatic break at the focus target.
- Manual time with date, start time, and end time.
- Timer and manual record editing and deletion.
- Persistent timer across major routes.
- Timer recovery across navigation, refresh, browser close, and temporary network loss.
- Explicit local/server reconciliation for material conflicts.
- In-app, browser, and optional sound notifications.

### Home

- Today's Focus Time.
- Today's completed Pomodoros.
- Today's interruptions.
- Today's Focus Ratio.
- Currently Focusing card.
- Continue Working card.
- Overdue task list.
- Due-today task list.
- Project cards with open count, completed-today count, and focus time today.
- Project ordering and quick actions.

### Analytics

- All projects or one selected project.
- Archived projects included historically by default.
- Today, Yesterday, This week, Last week, This month, Last month, All time, and custom periods.
- Monday-through-Sunday weeks.
- The same four canonical metrics as Home.
- Focus trend chart.
- Optional Pomodoro, interruption, and Focus Ratio trends.
- Interruption-reason breakdown.
- Timer-versus-manual transparency.
- Timezone-aware aggregation.
- Correct cross-midnight attribution.

### Export and data ownership

- Current-project export.
- All-project export.
- `Tasks.csv`.
- `TimeRecords.csv`.
- `Notes.csv`.
- Retained historical data included where specified.
- Trashed tasks included.
- Archived projects included where applicable.
- Permanently deleted data excluded.
- Deterministic serialization.
- Recoverable export failure behavior.
- No mutation during export generation.

### Responsive and accessibility behavior

- Desktop and tablet multi-column board.
- Desktop drag-and-drop with non-drag alternatives.
- Mobile one-column board.
- Mobile explicit `Move to...` action.
- Desktop task detail side panel.
- Mobile full-screen task details or sheet.
- Keyboard shortcuts for `N`, `/`, `Esc`, and `Enter`.
- Shortcuts disabled while typing in editable controls.
- Keyboard, touch, mouse, and screen-reader support.
- WCAG 2.2 AA target.
- Visible focus indicators.
- Sufficient contrast.
- No color-only communication of important state.
- Predictable focus management.
- Reduced-motion consideration.
- Appropriate touch-target sizing.

## 6. MVP exclusions

MVP does not include team collaboration.

MVP does not include project sharing.

MVP does not include roles or permissions.

MVP does not include assignees.

MVP does not include recurring tasks.

MVP does not include task dependencies or cross-board relationships.

MVP does not include timeline or Gantt views.

MVP does not include attachments.

MVP does not include custom fields.

MVP does not include estimates.

MVP does not include CSV import.

MVP does not include a public API.

MVP does not include webhooks.

MVP does not include third-party integrations beyond Google OAuth and email delivery.

MVP does not include offline-first editing.

MVP does not include advanced flow analytics.

MVP does not include forecasting.

MVP does not include workload planning.

## 7. Non-functional requirements

### Correctness and integrity

The server owns authorization and business invariants.

Critical multi-record operations must be transactional.

One unfinished focus session per account must be enforced by the server and database.

Start Focus must not partially move a task when WIP validation fails.

Completing a focused task must atomically finalize focus, save time, and complete the task.

Timer duration must come from persisted timestamps and interval boundaries rather than rendered UI ticks.

Browser throttling, refresh, navigation, and UI stalls must not materially change recorded duration.

Mutations must expose accurate saving, saved, and error states.

### Time and date correctness

Exact timestamps are stored in UTC.

Due dates are calendar dates rather than UTC instants.

Account timezone controls Today boundaries, due-date filters, manual-time interpretation, completion grouping, analytics buckets, and CSV formatting.

Daylight-saving transitions must be handled correctly.

Weeks run Monday through Sunday.

Records crossing local midnight must be attributed to the correct reporting periods.

### Capacity and performance

The practical design target is approximately 100 projects per account.

The practical design target is approximately 10,000 retained tasks.

The practical design target is approximately 50,000 time records.

Normal interactions should avoid full-page reloads.

Large historical completed sets may use pagination, incremental loading, or virtualization.

Analytics should aggregate on the server instead of downloading all raw history to the browser.

### Browser and accessibility support

The product targets current Chrome, Edge, Firefox, and Safari.

The product targets the latest two stable major versions where practical.

The product includes contemporary iOS/iPadOS Safari and Android Chrome.

Optional browser capabilities such as notifications must degrade gracefully.

### Security and privacy

Production traffic requires TLS.

Passwords require secure password hashing.

Sessions and tokens require secure handling.

CSRF protection is required where applicable.

All client input requires server-side validation.

Markdown must be sanitized before rendering.

Sensitive authentication operations require rate limiting.

OAuth flows require secure state handling.

Production secrets must not enter client bundles or source control.

Logs must avoid task descriptions, notes, passwords, tokens, and raw exports.

### Observability

Production monitoring should cover application errors.

Production monitoring should cover request failures.

Production monitoring should cover authentication failures and anomalies.

Production monitoring should cover timer persistence and reconciliation failures.

Production monitoring should cover export failures.

Production monitoring should cover analytics aggregation failures.

Production monitoring should cover background-job failures if jobs are later introduced.

Production monitoring should cover latency and availability.

Technical correlation identifiers should be used without exposing personal content.

## 8. Important ambiguities and assumptions

### Repository and stack

The current repository is not the application target.

The application should use a new private repository named `naufal1910/Taskfella`.

The recommended stack is TypeScript, React, Next.js, PostgreSQL, a typed SQL/migration layer, schema validation, sanitized Markdown, and browser testing.

### Timer-record editing

The PRD says timer-generated records can be edited but does not define the exact editable fields.

The implementation should define whether users edit timestamps, aggregate durations, Pomodoro count, interruptions, or all of these.

The safest design retains interval-level data and defines a deterministic edit contract before implementing the Time UI.

### Cross-midnight analytics

Aggregate duration fields alone cannot accurately split focus and pause time across local midnight.

The implementation should retain focus and pause interval timestamps or equivalent normalized segments.

### Unfinished focus

The recommended interpretation is that both running and paused focus sessions are unfinished.

Both states should block a second focus session for the account.

### Break persistence

The recommended interpretation is that break state is durable server state but remains separate from focus time and time records.

### WIP warning behavior

The recommended flow is for the server to return a warning without moving the task.

The client then repeats the request with an explicit confirmation.

The server rechecks WIP before committing.

### Blank template behavior

A blank board must still satisfy exactly one active and at least one completed column.

The creation form should either require valid columns before save or seed a minimal active/completed pair that can be renamed.

### Archiving with active focus

The PRD does not define whether a project containing the active focus task may be archived.

The conservative recommendation is to block archive until focus is stopped, avoiding hidden timer-context changes.

### Export packaging

The PRD defines three CSV files but not the delivery container.

The recommended delivery is a ZIP containing `Tasks.csv`, `TimeRecords.csv`, and `Notes.csv`.

Labels should use a deterministic sorted serialization.

Durations should use integer seconds.

Dates and times should use the account timezone.

### Additional missing product requirements

The PRD does not specify password policy.

The PRD does not specify session lifetime and rotation details.

The PRD does not specify Google account-linking behavior.

The PRD does not specify an email provider or sending domain.

The PRD does not specify hosting, backups, recovery objectives, or data retention.

The PRD does not specify reauthentication behavior for Google-only accounts.

The PRD does not specify Focus Ratio rounding or no-data display.

The PRD does not specify custom-range boundary inclusivity.

The PRD does not specify exact daylight-saving behavior for ambiguous manual local times.

The PRD does not specify final visual branding or detailed copy.

## 9. Technical risks and mitigations

### Timer correctness

Client tick-based timers can record incorrect durations after refresh, browser sleep, background throttling, or UI stalls.

Mitigation is persisted UTC timestamps, focus intervals, interruption intervals, fake-clock tests, and server authority.

### Multi-tab and multi-device concurrency

Concurrent tabs or devices can create duplicate focus sessions or stale controls.

Mitigation is a database partial unique constraint combined with account-level transactional locking.

### Coupled domain operations

Start Focus, task movement, WIP, completion, and time finalization can leave partial state if implemented as independent updates.

Mitigation is explicit transactional domain operations.

### Timezone and daylight-saving errors

Incorrect local-day calculation can corrupt Home, Analytics, and exports.

Mitigation is one canonical timezone-aware metric service with cross-midnight and DST fixtures.

### Markdown security

Raw HTML, unsafe links, or insufficient sanitization can cause stored XSS.

Mitigation is a strict allowed Markdown subset and sanitizer at the trust boundary.

### Responsive board interaction

A drag-only implementation would fail mobile and keyboard requirements.

Mitigation is explicit move controls as first-class operations.

### Historical deletion semantics

Trash, archive, and permanent deletion have different analytics consequences.

Mitigation is explicit cascade policies and source-record integration tests.

### Export completeness

Partial or nondeterministic exports would violate data ownership expectations.

Mitigation is snapshot queries, deterministic serialization, ZIP generation, and failure-before-delivery behavior.

### External authentication and email

OAuth, email verification, and password reset can block deployment if provider configuration is missing.

Mitigation is isolated provider adapters, local fakes, and staging-provider verification.

### No existing application foundation

Starting feature work in the firstmate repository would cause repository, CI, and deployment conflicts.

Mitigation is creating the separate Taskfella repository before implementation.

## 10. Proposed architecture

### Architecture style

Use a modular monolith with one responsive web client, one application/API deployment, and one primary relational database.

```text
Responsive browser client
        |
        | HTTPS and same-origin JSON API
        v
Single TypeScript web application
        |
        v
PostgreSQL

External dependencies:
- Google OAuth
- Transactional email
- Browser notifications
- Optional browser audio
```

The MVP should not require Kubernetes, a service mesh, event streaming, multiple primary databases, a dedicated analytics warehouse, Redis, or a dedicated search cluster.

### Recommended implementation stack

Use TypeScript.

Use React for the frontend.

Use Next.js for the single web and API deployment.

Use PostgreSQL for transactional data, constraints, and timezone-aware queries.

Use a thin typed SQL and migration layer such as Drizzle.

Use schema validation such as Zod at the API boundary.

Use a maintained Markdown parser and sanitizer.

Use unit and integration testing appropriate to the TypeScript stack.

Use Playwright for browser workflows and responsive verification.

Keep domain services independent of UI components and framework route handlers.

### Suggested application structure

```text
src/
  app/
    (auth)/
      login/
      signup/
      verify-email/
      reset-password/
    (product)/
      home/
      projects/[projectId]/
      analytics/
      settings/
    api/
      auth/
      account/
      projects/
      boards/
      tasks/
      focus/
      analytics/
      exports/

  components/
    board/
    task/
    timer/
    analytics/
    settings/
    navigation/

  server/
    config/
    db/
      schema/
      migrations/
    modules/
      auth/
      account/
      projects/
      workflow/
      tasks/
      focus/
      time/
      analytics/
      export/
    http/
      errors/
      auth/
      validation/

  lib/
    dates/
    markdown/
    csv/
    ids/
```

### Frontend architecture

Use server-rendered initial data where practical.

Use client components for board interactions, task details, timer controls, drag-and-drop, and notifications.

Use React context and a reducer for the global timer.

Use URL query parameters for board filters and analytics periods.

Use local reducer state for panels, forms, and optimistic interactions.

Use local storage only for minimal timer recovery metadata during temporary network loss.

Do not treat the client timer as authoritative.

Refetch server state after authoritative timer mutations.

Use tab synchronization only as an optimization rather than a correctness mechanism.

Ensure every drag action has a non-drag equivalent.

Expose saving, saved, and error states accessibly.

### Backend and API architecture

Use explicit JSON domain operations instead of unrestricted field updates.

Representative operations include:

```text
POST /api/focus/start
POST /api/focus/:id/pause
POST /api/focus/:id/resume
POST /api/focus/:id/stop
POST /api/focus/:id/start-break

POST /api/tasks/:id/move
POST /api/tasks/:id/restore
POST /api/tasks/:id/permanent-delete

POST /api/projects/:id/archive
POST /api/projects/:id/restore
POST /api/projects/:id/permanent-delete

POST /api/columns/:id/change-role
POST /api/time-records/:id/delete
```

Use stable domain error codes such as `ACTIVE_FOCUS_EXISTS`, `WIP_LIMIT_REACHED`, `WIP_CONFIRMATION_REQUIRED`, `TASK_COMPLETED`, `TASK_TRASHED`, `BOARD_INVARIANT_VIOLATION`, `CONCURRENT_UPDATE`, and `INVALID_TIME_RANGE`.

Use `401` for unauthenticated requests.

Use `403` for authenticated requests without permission.

Use `404` for resources that are not visible to the account.

Use `409` for concurrency or invariant conflicts.

Use `422` for invalid input.

### Database schema

#### Authentication and account tables

- `accounts`
- `password_credentials`
- `auth_identities`
- `sessions`
- `email_verification_tokens`
- `password_reset_tokens`

`accounts` contains identity, timezone, appearance, notification, sound, and Pomodoro preferences.

#### Project and workflow tables

- `projects`
- `columns`
- `swimlanes`
- `labels`
- `task_labels`

Use a unique partial index or equivalent constraint for one active column per project.

Enforce at least one completed column inside locked transactions.

Validate WIP mode and limit consistency at both database and application boundaries.

#### Task tables

- `tasks`
- `subtasks`
- `notes`
- `task_lifecycle_events`

Retain nullable prior-location fields on tasks for Trash restoration.

Use fallback rules when the prior column or swimlane no longer exists.

#### Focus and time tables

- `focus_sessions`
- `focus_intervals`
- `interruptions`
- `break_sessions`
- `time_records`
- Normalized time segments if required for exact local-day allocation.

Use a partial unique index for one unfinished focus session per account.

Store active focus intervals rather than relying on rendered timer ticks.

Keep break sessions separate from focus time and historical time records.

### Authentication and authorization

Hash passwords with Argon2id or an equivalent current password-hashing algorithm.

Use database-backed sessions in secure, HttpOnly, SameSite cookies.

Rotate sessions after login and sensitive account changes.

Protect cookie-authenticated mutations against CSRF.

Use OAuth state validation and PKCE where supported.

Store verification and reset tokens hashed, single-use, and expiring.

Rate-limit login, signup, verification, reset, and OAuth failure paths.

Scope every data query through the authenticated account.

Never use client-supplied IDs as authorization.

Invalidate sessions during account deletion.

### Validation

Use browser validation for usability.

Use API schema validation for all client input.

Use domain and database validation for business invariants.

Validate titles, Markdown size, colors, date-only values, time ranges, WIP settings, column roles, lifecycle state, and ownership.

### State management

Use server data as the source of truth.

Use React context and a reducer for global timer presentation and controls.

Use URL state for filters and analytics periods.

Use local reducer state for transient forms, panels, and rollback-capable interactions.

Do not introduce Redux or a large global state layer for MVP.

### Background jobs

No background jobs are required for the initial MVP.

Timers are reconstructed from timestamps.

Analytics is queried from PostgreSQL.

Exports can be generated synchronously at the target scale.

Browser notifications are client-side.

Email can initially use a provider API.

Add a database-backed outbox or job mechanism only if measured email or export latency requires it.

### Logging and error handling

Use structured JSON logs.

Attach a request or correlation ID to each request.

Separate safe domain errors from unexpected exceptions.

Use actionable user-facing error messages.

Exclude descriptions, notes, passwords, tokens, and raw export contents from logs.

Record authentication, timer reconciliation, export, and analytics failures as technical events.

### Security

Terminate TLS in production.

Supply secrets only through deployment configuration.

Sanitize Markdown at the trust boundary.

Disable raw HTML and unsafe URL schemes.

Protect CSV output from formula injection.

Require explicit confirmation for destructive actions.

Require reauthentication for account deletion and other sensitive actions.

Use same-origin protections and secure cookies.

Never expose secrets in browser bundles.

### Deployment

Recommended deployment shape:

```text
Managed TLS or reverse proxy
        |
Single Node application container
        |
Managed PostgreSQL
        |
Transactional email provider
        |
Google OAuth
```

Local development should use Node and Docker Compose PostgreSQL.

The application should provide `.env.example` and a migration command.

Likely environment variables include:

```text
DATABASE_URL
APP_URL
SESSION_SECRET
GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET
EMAIL_PROVIDER_URL
EMAIL_PROVIDER_API_KEY
EMAIL_FROM
NODE_ENV
```

Run migrations in a controlled deployment step.

Enable managed database backups.

Test restoration before production launch.

Keep application containers stateless.

Do not store user content in local container files.

## 11. Dependency-aware implementation plan

### Phase 0: Foundation and stack

#### Objective

Create a minimal deployable application foundation without product behavior.

#### Features

- Application shell.
- Health endpoint.
- Environment validation.
- PostgreSQL connection.
- Migration runner.
- Local development setup.
- Basic CI.
- Error and request-ID plumbing.

#### Likely files

```text
package.json
next.config.*
src/app/layout.tsx
src/app/page.tsx
src/app/api/health/route.ts
src/server/config.ts
src/server/db/client.ts
src/server/http/errors.ts
drizzle.config.ts
drizzle/
.env.example
Dockerfile
compose.yaml
.github/workflows/ci.yml
```

#### Database changes

Create database connection and migration infrastructure.

No product tables are required beyond migration metadata.

#### API changes

Add `GET /api/health`.

#### Frontend changes

Add an empty responsive application shell with loading and error boundaries.

#### Tests

Test environment validation, health response, database connection, migration execution, and application boot.

#### Verification

Start the local app.

Start local PostgreSQL.

Run migrations.

Receive a successful health response.

Confirm CI runs in a clean environment.

#### Dependencies

None.

### Phase 1: Authentication and account settings

#### Objective

Make the application usable by an authenticated account.

#### Features

Implement signup, login, logout, email verification, password reset, Google OAuth, sessions, account settings, timezone, appearance, Pomodoro settings, and notification preferences.

#### Likely modules

```text
src/server/modules/auth/
src/server/modules/account/
src/app/(auth)/
src/app/(product)/settings/
src/components/auth/
src/components/settings/
```

#### Database changes

Add accounts, password credentials, OAuth identities, sessions, verification tokens, and reset tokens.

#### API changes

Add authentication endpoints, current-account endpoint, settings endpoints, and reauthentication endpoint.

#### Frontend changes

Add authentication screens, protected application shell, settings screens, theme handling, and accessible authentication errors.

#### Tests

Test signup, password hashing, login/logout, session invalidation, verification expiry, password reset expiry, OAuth state validation, ownership isolation, and settings persistence.

#### Verification

A new user can register, verify, log in, configure settings, log out, and return with the same account state.

#### Dependencies

Phase 0.

### Phase 2: Projects, boards, workflow, and WIP

#### Objective

Create the board-first project surface with valid workflow configuration.

#### Features

Implement templates, project ordering, archive/restore, project deletion flow, columns, semantic roles, swimlanes, labels, WIP modes, WIP limits, completed grouping preference, and invariant enforcement.

#### Likely modules

```text
src/server/modules/projects/
src/server/modules/workflow/
src/app/(product)/home/
src/app/(product)/projects/[projectId]/
src/components/board/
src/components/project/
```

#### Database changes

Add projects, columns, swimlanes, labels, and ownership/lifecycle fields.

#### API changes

Add project CRUD, board configuration, role changes, ordering, swimlane operations, labels, archive, restore, and deletion.

#### Frontend changes

Add Home project list, project creation wizard, empty board, board settings, responsive column navigation, WIP indicators, and configuration dialogs.

#### Tests

Test templates, active-column invariants, completed-column invariants, role transitions, empty-column deletion, WIP configuration, archive/restore, and ownership.

#### Verification

A user can create each project template, open a valid board, customize its workflow, archive and restore it, and cannot save an invalid board.

#### Dependencies

Phase 1.

### Phase 3: Tasks and board execution

**Current implementation record:** [taskfella-phase3-tasks.md](taskfella-phase3-tasks.md). The branch implementation remains pending the captain-approved PR merge and issue #5 remains open until then.

#### Objective

Make the board useful for planning and moving work.

#### Features

Implement quick creation, add-details flow, task details, Markdown, labels, color, due dates, subtasks, notes, search, filters, reordering, movement, completion, reopening, Trash, restore, permanent deletion, and lifecycle events.

#### Likely modules

```text
src/server/modules/tasks/
src/server/modules/notes/
src/server/modules/markdown/
src/app/api/tasks/
src/components/task/
src/components/board/TaskCard.tsx
src/components/task/TaskDetails.tsx
```

#### Database changes

Add tasks, task-label joins, subtasks, notes, lifecycle events, and Trash restoration fields.

#### API changes

Add task creation and updates, movement, reordering, subtasks, notes, search, filters, Trash, restore, and permanent deletion.

#### Frontend changes

Add desktop board columns, mobile board navigation, task cards, quick entry, detail side panel, mobile task details, Move to... controls, search, and filters.

#### Tests

Test quick creation, Markdown sanitization, search, filters, completion, reopening, WIP movement, role-based completion, Trash restore fallback, permanent deletion, and keyboard-only task actions.

#### Verification

A user can fully plan and manage a project on desktop and mobile without requiring drag-and-drop for any required state change.

#### Dependencies

Phase 2.

### Phase 4: Focus, Pomodoro, interruptions, breaks, and time

#### Objective

Implement the highest-risk domain: trustworthy focus and time tracking.

#### Features

Implement Start Focus, active-column movement, the one-session invariant, pause/resume, interruption reasons, stop, breaks, overtime, manual time, time-record editing/deletion, global timer, browser recovery, temporary network recovery, conflict handling, and notifications.

#### Likely modules

```text
src/server/modules/focus/
src/server/modules/time/
src/server/modules/timer/
src/app/api/focus/
src/app/api/time-records/
src/components/timer/
src/components/task/TimeTab.tsx
src/lib/timer-recovery.ts
```

#### Database changes

Add focus sessions, focus intervals, interruptions, break sessions, time records, and normalized time segments if required.

#### API changes

Add focus status, start, pause, resume, stop, break operations, timer recovery, reconciliation, manual time, and time-record mutation endpoints.

#### Frontend changes

Add global timer provider, timer controls, pause reason dialog, focus conflict dialog, recovery UI, manual time form, time history, and contextual notification permission.

#### Tests

Test refresh recovery, browser restart recovery, temporary network loss, multi-tab invariants, WIP behavior, completion while focusing, pause/resume, overtime, manual time recalculation, timer-record edits, timer-record deletion, fake-clock math, DST, breaks, completed-task rejection, trashed-task rejection, and ownership.

#### Verification

The timer remains correct across refresh and browser restart.

Each focus mutation either commits coherently or leaves no partial task/timer state.

#### Dependencies

Phases 1 through 3.

### Phase 5: Home and canonical analytics

#### Objective

Expose daily summaries and historical focus insights using one metric implementation.

#### Features

Implement Home summary, Currently Focusing, Continue Working, overdue and due-today lists, project cards, analytics scope and periods, primary metrics, trends, interruption breakdown, timer/manual breakdown, archived-project history, and timezone-aware reporting.

#### Likely modules

```text
src/server/modules/analytics/
src/server/modules/home/
src/lib/dates/
src/app/(product)/analytics/
src/components/analytics/
src/components/home/
```

#### Database changes

Add analytics query indexes.

Do not add independent analytics source tables.

#### API changes

Add Home summary, analytics metrics, trends, and interruption breakdown endpoints.

#### Frontend changes

Add Home dashboard, Analytics dashboard, period selectors, project selectors, accessible charts, and no-data states.

#### Tests

Test Home/Analytics parity, periods, Monday weeks, month boundaries, cross-midnight allocation, DST, archive/restore, Trash/permanent deletion, manual versus timer contributions, and Focus Ratio edge cases.

#### Verification

Home and Analytics return identical canonical metrics for identical data, scope, and period.

#### Dependencies

Phase 4.

### Phase 6: Exports, privacy, and destructive lifecycle

#### Objective

Complete data ownership and deletion requirements.

#### Features

Implement project export, all-project export, deterministic CSV generation, project deletion, task permanent deletion, account deletion, reauthentication, privacy settings, and recoverable export failures.

#### Likely modules

```text
src/server/modules/export/
src/server/modules/privacy/
src/lib/csv/
src/app/api/exports/
src/app/(product)/settings/data/
src/components/export/
src/components/destructive-action/
```

#### Database changes

Verify permanent-delete cascades and export query indexes.

#### API changes

Add project export, all-project export, account deletion, reauthentication, and permanent-delete endpoints.

#### Frontend changes

Add export actions, destructive confirmation dialogs, account deletion flow, and clear lifecycle distinctions.

#### Tests

Test deterministic CSV headers, retained-data completeness, Trashed-task inclusion, archived-project inclusion, permanent-deletion exclusion, CSV injection safety, export failure, project deletion, account deletion, and session invalidation.

#### Verification

Exports contain the complete retained scope, exclude permanently deleted data, and never deliver partial output silently.

#### Dependencies

Phases 1 through 5.

### Phase 7: Accessibility, reliability, performance, and release

#### Objective

Verify the product as a complete daily-use system.

#### Features

Complete keyboard-only flow, mobile flow, reduced-motion behavior, browser zoom behavior, long-content handling, saving/error states, performance tuning, production logging, monitoring, deployment automation, and backup/restore verification.

#### Likely modules

```text
tests/unit/
tests/integration/
tests/e2e/
tests/accessibility/
playwright.config.*
Dockerfile
.github/workflows/*
docs/deployment.md
src/server/observability/
```

#### Database changes

Add final indexes based on measured query plans.

Verify migration and restore procedures.

#### API changes

Standardize error envelopes, correlation IDs, rate limits, request-size limits, and health/readiness endpoints.

#### Frontend changes

Complete accessibility, responsive behavior, performance, pagination, and virtualization where measurements require them.

#### Tests

Run all 18 release verification scenarios from the PRD.

Test timer recovery, concurrency, WIP transactionality, timezone changes, deletion semantics, exports, keyboard desktop flow, mobile flow, appearance modes, reduced motion, browser zoom, and long-content states.

#### Verification

The complete daily loop works with desktop keyboard input and on mobile without cross-column drag-and-drop.

#### Dependencies

Phases 1 through 6.

## 12. Recommended first implementation task

The first implementation task is repository and foundation setup rather than a Kanban feature.

The task is:

```text
Create the approved GitHub repository
-> clone and register it locally
-> initialize delivery checks
-> scaffold the application foundation
-> add PostgreSQL migration infrastructure
-> add the health endpoint
-> verify local startup and database connectivity
```

The foundation task should not implement product behavior beyond the shell, configuration, database connection, migration runner, health endpoint, and CI smoke checks.

## 13. Current blocker at handoff

The repository creation was not performed because the current Firstmate session entered read-only mode.

The exact diagnostic was:

```text
cannot locate harness process in ancestry
```

A fresh Firstmate session from a supported harness is required before the authorized remote creation, local registration, delivery initialization, and implementation dispatch can proceed.

