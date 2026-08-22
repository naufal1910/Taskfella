# Taskfella MVP Product Requirements and Design Specification

**Date:** 2026-08-09  
**Status:** Approved design consolidated for final review  
**Product:** Taskfella  
**Product direction:** Board-first Kanban with integrated Pomodoro, time tracking, and personal analytics

## 1. Product Summary

Taskfella is a responsive, personal-first project execution web application that combines a customizable Kanban board with integrated Pomodoro focus sessions, manual time tracking, and personal focus analytics.

Its core daily loop is:

```text
PLAN
  -> organize work on a Kanban board
SELECT
  -> choose a task
FOCUS
  -> start a Pomodoro
WORK
  -> pause/resume when interrupted
LOG
  -> save actual focus time or add manual time
MOVE
  -> progress the task through the board
FINISH
  -> complete the task by moving it into a completed column
ANALYZE
  -> review focus time, Pomodoros, interruptions, and focus ratio
IMPROVE
  -> use the insight to plan the next work period
```

The MVP succeeds when a person can use Taskfella as their primary daily personal execution system without needing one separate Kanban application plus another Pomodoro/time-tracking application.

## 2. Product Goals and Success Criteria

### 2.1 Primary goal

Provide one coherent workflow for planning personal projects, choosing work, focusing, recording actual effort, finishing tasks, and reviewing personal focus behavior.

### 2.2 Primary success criterion

**Personal daily-use success.** A user can rely on Taskfella as their main personal execution system for recurring daily work.

### 2.3 Workflow-completion acceptance criterion

A successful user can reliably complete this end-to-end flow:

```text
Create/open project
-> create tasks
-> organize board
-> choose a task
-> start focus
-> pause/resume if interrupted
-> complete or stop focus
-> log manual time if needed
-> move task through workflow
-> finish task
-> review today's analytics
-> return later and continue
```

The MVP should prioritize reliability and consistency of this workflow over feature count or post-launch growth metrics.

## 3. Product Experience Model

### 3.1 Experience hierarchy

```text
Home
├── Today summary
├── Currently focusing / Continue working
├── Overdue tasks
├── Due-today tasks
└── Project list
        |
        v
Project / Kanban Board
├── Customizable columns
├── Optional swimlanes
├── Task cards
├── Search and filters
├── WIP indicators
├── Project actions
└── Persistent timer
        |
        v
Task Details
├── Details
├── Subtasks
├── Notes
└── Time
        |
        v
Personal Analytics
```

### 3.2 Board-first principle

The Kanban board is the primary work surface inside a project. Home remains the post-login launchpad, but opening a project leads directly to its board.

Taskfella should not become a generic Kanban clone. Its differentiation comes from making focus behavior part of the board workflow:

- starting focus moves a task into the board's active column when needed;
- task cards expose lightweight Pomodoro/focus summaries;
- the active timer is globally persistent;
- task details combine planning, notes, subtasks, and time history;
- completion updates personal analytics immediately.

### 3.3 Desktop/tablet behavior

Desktop and larger tablets use a multi-column board. Drag-and-drop is available for moving and reordering cards. Opening a task uses a right-side detail panel so the board remains visible.

### 3.4 Mobile behavior

Mobile shows one board column at a time. Users switch columns using a tab, selector, or equivalent compact navigation. Cross-column movement uses an explicit **Move to...** action rather than requiring drag-and-drop. Task details open as a full-screen page or sheet.

The mobile interface must still support all core workflows: create, open, edit, move, complete, reopen, delete, and Start Focus.

## 4. Project and Board Model

### 4.1 Hierarchy

For MVP, **Board = Project**. There is no separate project entity above a board.

```text
Account
└── Project / Board
    ├── description
    ├── columns
    ├── optional swimlanes
    ├── board-specific labels
    └── tasks
```

### 4.2 Project creation

Project creation is a guided lightweight flow containing:

- project name;
- optional project description;
- workflow template.

MVP templates:

1. **Personal Project**: `Backlog -> Today -> In Progress -> Review -> Done`
2. **Simple**: `To Do -> In Progress -> Done`
3. **Blank**: user configures columns manually, subject to board invariants.

Project descriptions support the same constrained Markdown subset as task descriptions and are collapsible at the top of the board.

### 4.3 Project lifecycle

Projects support:

- **Active**;
- **Archived**;
- **Deleted permanently**.

Archiving is reversible and retains project data and historical analytics contribution. Archived projects are excluded from Home's actionable overdue/due-today lists but remain selectable in analytics.

Permanent deletion is destructive, requires explicit confirmation, removes project source data, and removes the corresponding analytics contribution.

## 5. Column and Workflow Model

### 5.1 Column semantic roles

Column names are fully customizable, but behavior is driven by one fixed semantic role per column:

- `queued`
- `planned`
- `active`
- `review`
- `completed`
- `neutral`

Default Personal Project mapping:

| Column | Semantic role |
|---|---|
| Backlog | queued |
| Today | planned |
| In Progress | active |
| Review | review |
| Done | completed |

### 5.2 Required board invariants

Every board must always have:

- exactly one `active` column;
- at least one `completed` column.

Multiple completed columns are permitted.

The application blocks configuration changes that would leave zero active columns, more than one active column, or zero completed columns.

### 5.3 Column customization

Users can add, rename, reorder, configure, and delete columns. Column ordering is independent of semantic-role ordering.

Deletion is allowed only when the column is empty and when its removal would not violate required role invariants.

### 5.4 Semantic-role changes

Changing a role that does not affect completion state can take effect immediately.

If a change would alter completion state for tasks in that column, Taskfella requires confirmation:

- non-completed role -> `completed`: contained tasks become completed;
- `completed` -> non-completed role: contained tasks reopen.

Current `completed_at` is updated accordingly, while completion/reopen lifecycle events remain preserved historically.

### 5.5 Changing the active column

Changing which column is `active` does not automatically move existing tasks. Future Start Focus actions use the new active column and move tasks there as needed.

## 6. WIP Limits

WIP limits apply at the **column level only**.

Each column supports:

- `none`;
- `warn`;
- `enforce`.

`warn` allows the move after showing a warning. `enforce` blocks the move.

WIP counts all non-trashed tasks currently in that column across all swimlanes, regardless of active filters. A filtered board may therefore show information such as `1 visible · 3/3 WIP`.

Start Focus must respect the same WIP rule because it may automatically move a task into the active column. A hard WIP violation blocks focus start and must not partially move the task.

## 7. Swimlanes and Ordering

### 7.1 Swimlanes

Swimlanes are optional and user-defined. Taskfella assigns no built-in semantic meaning to their names. They are manually reorderable and have no independent WIP limit.

### 7.2 Ordering

Persist manual ordering for:

- projects;
- columns;
- swimlanes;
- tasks;
- subtasks.

Task ordering is independent for each `(column, swimlane)` location.

Desktop/tablet supports drag-and-drop reordering. Mobile displays the persisted order but does not require drag gestures for cross-column movement.

## 8. Task Model

### 8.1 MVP task fields

A task contains:

- title;
- description;
- current column;
- optional swimlane;
- board-specific labels;
- purely visual color;
- optional date-only due date;
- checklist subtasks;
- personal notes/comments;
- time/focus records;
- created timestamp;
- current completion timestamp when completed.

Not included in MVP:

- task estimates;
- attachments;
- custom fields;
- recurring tasks;
- task dependencies or cross-board relationships.

### 8.2 Title and description

Task titles are plain text.

Task descriptions support constrained, sanitized Markdown including headings, bold, italic, bullet/numbered lists, links, inline code, and code blocks.

MVP descriptions do not support raw HTML, embedded images, tables, attachments, or executable content.

### 8.3 Labels and color

Labels are board-specific and carry semantic meaning chosen by the user.

Task color is purely visual. It does not implicitly represent priority, status, urgency, ownership, or category. Color is filterable.

### 8.4 Due date

Due date is a calendar date only, with no time or reminder in MVP. The application supports overdue, due today, due this week, and no-due-date filtering using the account timezone.

### 8.5 Subtasks

Subtasks are checklist items containing text, completion state, and position. They do not have independent due dates, labels, timers, workflow columns, or time records.

### 8.6 Personal notes/comments

Tasks support chronological personal notes as a lightweight work journal.

Each note contains body text, created timestamp, and updated timestamp. Notes support the same constrained Markdown subset as descriptions and are editable/deletable.

MVP notes do not support replies, mentions, reactions, attachments, or team-conversation behavior.

## 9. Task Search and Filtering

### 9.1 Search

Task search matches:

- title;
- description;
- subtask text;
- personal note/comment text.

It does not search time-record fields or internal lifecycle history.

### 9.2 Filters

MVP board filters:

- search text;
- label;
- color;
- due-date state;
- column;
- swimlane.

No assignee/user filter is exposed in MVP because collaboration is not included.

## 10. Task Creation and Details

### 10.1 Quick creation

Task creation is optimized for capture speed. A user can add a task from the current column/swimlane by entering a title and submitting immediately.

The UI offers an **Add details** path that creates the task and opens its detail interface.

After quick creation, the input remains open and focused for batch entry until the user closes it.

Quick-created tasks inherit the current column and current swimlane, if any.

### 10.2 Task details

Task details are organized into clear sections/tabs:

- **Details**: description, column, swimlane, labels, color, due date;
- **Subtasks**: checklist;
- **Notes**: personal work journal;
- **Time**: Start Focus, focus summary, Pomodoro count, timer records, manual records, edit/delete controls.

Desktop opens task details in a right-side panel. Mobile opens them as a full-screen page or sheet.

### 10.3 Task card summary

Where space permits, cards show lightweight execution context including:

- title;
- labels;
- due date;
- completed Pomodoro count;
- total focus time.

## 11. Task Completion, Reopening, Trash, and Restore

### 11.1 Completion

Moving a task into any column with semantic role `completed` completes it and sets `completed_at` to the current timestamp.

Moving a task between two completed columns does not reopen it.

Completed tasks cannot start a new focus session until reopened.

### 11.2 Reopening

Moving a completed task to any non-completed column reopens it and clears the current `completed_at` value. Historical completion/reopen lifecycle events remain preserved.

If the task is completed again later, `completed_at` becomes the latest completion time.

### 11.3 Completion while focusing

If a task with an active focus session is moved into a completed column, Taskfella automatically:

1. stops the focus session;
2. saves actual focus time;
3. completes the task;
4. does not automatically start a break.

These effects should commit as one coherent operation.

### 11.4 Completed-task grouping

Each completed column can independently display either:

- a plain list;
- grouping by completion date.

Grouping uses the current `completed_at` timestamp and the account timezone.

### 11.5 Trash

Deleting a task performs a soft delete to Trash. The task disappears from the active board while subtasks, notes, time records, interruptions, lifecycle events, and historical analytics remain attached.

Trash actions:

- Restore;
- Delete permanently.

Restore attempts to return the task to its previous column/swimlane and best-effort previous position. If the original swimlane no longer exists, restore to the original column without a swimlane. If the original column no longer exists, restore to the first non-completed column. If the project itself is archived, task restoration is rejected until the project is restored; archiving makes the board read-only while retaining its history.

Permanent task deletion removes the source data and its contribution to analytics.

## 12. Focus, Pomodoro, and Time Tracking

### 12.1 Time-entry modes

MVP supports:

- Pomodoro/timer-based focus;
- manual time entry.

There is no generic stopwatch mode.

### 12.2 Starting Focus

Start Focus can be invoked from a task card, task details, Home's Continue Working card, or equivalent task context.

If the task is not in the board's active column, Start Focus attempts to move it there first, subject to WIP rules.

Completed or trashed tasks cannot start focus.

### 12.3 One active focus session

An account may have exactly one unfinished focus session at a time, even across multiple browser tabs or devices.

If another focus session is active, starting a new one offers:

- go to current focus;
- stop current and start the new task;
- cancel.

The server, not only the client, enforces this invariant.

### 12.4 Pomodoro settings

Account-level settings:

- focus duration;
- short-break duration;
- long-break duration;
- long break after N completed focus sessions;
- sound on/off.

Changes affect new sessions only and do not alter the target duration of an already-running session.

### 12.5 Focus timer semantics

The configured focus duration is a target, not a hard stop.

Example for a 25-minute target:

```text
25:00 -> ... -> 00:00 -> +00:01 -> +00:02 -> ...
```

When the target is first reached:

- one completed Pomodoro is recorded;
- the user is notified;
- focus continues counting as overtime until Pause, Start Break, Stop, or task completion.

Examples:

- 18 minutes actual focus -> 18 minutes focus, 0 Pomodoros;
- 38 minutes actual focus with 25-minute target -> 38 minutes focus, 1 Pomodoro, 13 minutes overtime;
- 60 minutes in one extended session with a 25-minute target -> still 1 completed Pomodoro for that session.

### 12.6 Pause and interruptions

Pause immediately stops focus-time accumulation and then asks for an interruption reason.

Reason choices:

- Phone/message;
- Person/conversation;
- Meeting/call;
- Distraction;
- Break/personal need;
- Task-related;
- Other;
- Skip.

Each pause creates an interruption event. Choosing Skip records an uncategorized interruption. Pause duration does not count as focus time.

The session stays paused until explicitly resumed.

### 12.7 Focus Ratio

Canonical formula:

```text
Focus Ratio = Focus Time / (Focus Time + Paused Time) * 100
```

Where Focus Time includes both timer focus and manual focus. Break time is excluded.

Manual time therefore increases both the numerator and the focus-time component of the denominator, but does not create paused time.

### 12.8 Ending focus

- **Stop**: end/save focus, no break.
- **Start Break**: end/save focus, then start the appropriate short or long break.
- **Pause**: keep the focus session open but paused.

A break never starts automatically when the focus target is reached.

### 12.9 Break behavior

Break timers count down to zero. On completion, Taskfella notifies the user and waits. It does not automatically start another focus session and does not count break overtime.

The next focus action defaults to the same task while allowing another task to be selected.

### 12.10 Global timer

A compact persistent timer is visible across Home, Board, Task Details, Analytics, and Settings while focus or break state exists.

It shows task/context, current countdown or overtime, and relevant controls. It also acts as a shortcut back to the active task/focus context.

### 12.11 Timer persistence and recovery

Timer state is durable application state, not a UI-only JavaScript countdown.

Persist enough information to reconstruct the timer from timestamps, including start time, target duration, pauses, target reached state, end time, and status.

The timer must recover correctly across:

- navigation;
- page refresh;
- browser close/reopen;
- temporary network loss.

An already-running timer may continue locally during temporary network loss using minimal cached recovery state. When connectivity returns, reconcile with the persisted server state.

If local and server states materially conflict, present an explicit recovery choice rather than silently discarding one version.

### 12.12 Notifications

Notify for:

- focus target reached;
- break completed.

Channels:

- in-app indicator;
- browser notification where permission is granted;
- optional built-in sound.

Notification permission should be requested contextually rather than immediately on first visit.

### 12.13 Manual time

Manual time entry uses:

- date;
- start time;
- end time.

Taskfella calculates duration. If the entered end time is earlier than the start time, MVP interprets the end as occurring on the next local calendar day; identical start and end times are invalid.

Manual time:

- counts as Focus Time;
- contributes to Focus Ratio;
- creates no completed Pomodoros;
- creates no interruption events;
- creates no paused time;
- creates no overtime;
- never moves the task into the active column.

### 12.14 Time-record editing

Both timer-generated and manual time records can be viewed, edited, and deleted. Edits replace record values; no revision history is required in MVP.

Each record retains a source value of `pomodoro` or `manual`. Analytics recalculates after edits or deletions.

## 13. Home

### 13.1 Purpose

Home is a launchpad, not a second task-management interface. It should answer:

- What needs attention today?
- What was I working on recently?
- Which project should I open?

### 13.2 Today summary

Home displays four canonical metrics for the current account-local day:

- Focus Time;
- Completed Pomodoros;
- Interruptions;
- Focus Ratio.

Home and Analytics must use the same metric definitions.

When a focus record crosses midnight in the account timezone, reporting attributes elapsed portions to the correct local calendar day rather than assigning the whole record to its start day.

### 13.3 Currently Focusing

If a focus session is active, Home shows a Currently Focusing card with task, project, timer context, focus accumulated today, and Open Task. The global timer remains the primary timer-control surface.

### 13.4 Continue Working

When no session is active, Home may show one most-recently-focused actionable task.

The candidate must not be completed, trashed, permanently deleted, or inside an archived project.

The card provides task/project context plus Open Task and Start Focus. Start Focus uses the same active-column and WIP rules as everywhere else.

### 13.5 Overdue and Due Today

Home aggregates actionable overdue and due-today tasks across all active projects. Archived projects are excluded.

Each item shows its source project. Lists should be compact and may use a capped preview plus View All.

### 13.6 Project list

Project cards show:

- project name;
- open task count;
- tasks completed today;
- focus time today.

No completion percentage is shown because MVP has no effort estimates.

Desktop/tablet project cards are manually reorderable. Quick actions include Open, Export project data, Archive, and Delete. Archived projects appear in a separate archived section with Restore and Delete permanently actions.

## 14. Personal Analytics

### 14.1 Purpose

MVP analytics answer personal focus questions, not project-flow questions.

Primary questions:

- How much focused work did I do?
- How many Pomodoros did I complete?
- How often was I interrupted?
- What was my Focus Ratio?
- Which interruption reasons recur?
- How are these values changing over time?

### 14.2 Scope

Analytics supports:

- all projects;
- one selected project.

Global historical analytics include archived projects by default. Permanently deleted source data is excluded.

### 14.3 Periods

Supported period filters:

- Today;
- Yesterday;
- This week;
- Last week;
- This month;
- Last month;
- All time;
- Custom range.

Weeks are Monday through Sunday in the account timezone.

### 14.4 Primary metrics

The four primary analytics cards are:

- Focus Time;
- Completed Pomodoros;
- Interruptions;
- Focus Ratio.

Definitions are shared with Home.

### 14.5 Trend charts

Primary trend visualization: Focus Time over time, with optional switching or companion views for Pomodoros, Interruptions, and Focus Ratio.

Recommended aggregation:

| Range | Bucket |
|---|---|
| Today / Yesterday | hourly |
| This week / Last week | daily |
| This month / Last month | daily |
| Custom up to 31 days | daily |
| Custom 32-180 days | weekly |
| Custom over 180 days | monthly |
| All time | monthly |

Weekly buckets use Monday-based account-local weeks.

### 14.6 Interruption breakdown

Provide a secondary count breakdown by interruption reason, including uncategorized/Skip. A compact ranked list or horizontal bar chart is sufficient.

### 14.7 Source transparency

Manual focus is included in Focus Time and Focus Ratio but does not count toward Pomodoros or interruptions. The UI may expose a secondary Timer vs Manual breakdown without making it the primary dashboard.

### 14.8 Analytics source of truth

Analytics is derived from retained source records such as time records, interruptions, task/project lifecycle state, and completion timestamps. It is not independently editable state.

Editing or deleting source records must cause analytics to recalculate consistently.

## 15. Authentication and Account

### 15.1 Authentication methods

MVP supports:

- email/password;
- Google sign-in.

Required flows include signup, login, logout, email verification, password reset, and Google OAuth.

### 15.2 Ownership model

Each MVP project has one account owner. Data entities carry explicit ownership/parent identifiers so future sharing/collaboration does not require replacing the personal-first data model.

### 15.3 Account settings

Main settings areas:

- Account;
- Pomodoro;
- Appearance;
- Notifications;
- Timezone;
- Data & Privacy.

### 15.4 Appearance

Supported appearance preferences:

- System (default);
- Light;
- Dark.

The preference applies consistently across all major routes and timer UI.

### 15.5 Timezone

The account has one editable timezone. Default is detected from the browser/device.

Store exact timestamps in UTC. Use the account timezone for Today boundaries, due-date interpretation, completion grouping, manual-entry interpretation, analytics buckets, and CSV display.

Changing timezone changes display/grouping, not the underlying instant of historical events.

## 16. CSV Export and Data Ownership

### 16.1 Export scope

CSV export is the only external integration in MVP.

Available scopes:

- current project;
- all projects.

Access points:

- Board menu -> Export project data;
- Settings/Data -> Export all project data.

### 16.2 Export package

The export contains:

- `Tasks.csv`;
- `TimeRecords.csv`;
- `Notes.csv`.

All-project exports include a stable project identifier and project name in every dataset.

### 16.3 Tasks.csv

Conceptual fields:

```text
project_id
project_name
task_id
title
description
column
swimlane
labels
color
due_date
created_at
completed_at
subtasks_summary
```

Multiple-value serialization must use one documented deterministic convention.

### 16.4 TimeRecords.csv

Conceptual fields:

```text
project_id
project_name
task_id
task_title
source
date
start_time
end_time
focus_duration_seconds
paused_duration_seconds
overtime_duration_seconds
completed_pomodoro
interruption_count
```

Dates/times are presented in the account timezone. Durations use deterministic machine-friendly units.

### 16.5 Notes.csv

Conceptual fields:

```text
project_id
project_name
task_id
task_title
note_id
body
created_at
updated_at
```

Each note is a separate row.

### 16.6 Interruption export boundary

MVP does not require a separate `Interruptions.csv`. Reason-level interruption events remain stored because Analytics needs them, while `TimeRecords.csv` exposes paused duration and interruption count. A richer future export may add an interruption dataset.

### 16.7 Export completeness and failure

Exports include retained historical data in the selected scope, including completed tasks, trashed tasks, and archived projects where applicable. Permanently deleted data is absent.

Export generation must never mutate source data. If generation fails, show a recoverable error rather than silently delivering a partial file.

### 16.8 Account deletion

Settings provides Delete Account with explicit destructive confirmation and reauthentication where appropriate.

Account deletion permanently removes the account's projects, tasks, subtasks, notes, time records, interruption data, analytics source data, preferences, and authentication linkage from the product's active data model.

The UI must clearly distinguish:

- Trash task -> reversible, analytics retained;
- Archive project -> reversible, analytics retained;
- Permanent deletion -> irreversible, analytics contribution removed;
- Delete account -> irreversible full-account deletion.

## 17. Navigation and Keyboard Shortcuts

Global navigation remains small:

- Home;
- Projects/current Board;
- Analytics;
- Settings;
- Account.

MVP shortcuts:

- `N` -> quick-create task in current context;
- `/` -> focus task search;
- `Esc` -> close panel/prompt/quick-create state;
- `Enter` -> submit quick-created task.

Shortcuts must not fire unexpectedly while typing in editable controls and cannot replace normal accessible controls. There is no command palette in MVP.

## 18. Responsive, Accessibility, and Browser Requirements

### 18.1 Responsive product behavior

Taskfella is one responsive web application.

Large/medium viewports prioritize multi-column board visibility and drag-and-drop. Small viewports show one column at a time, use explicit Move to... actions, full-screen task details, and a compact persistent timer.

### 18.2 Input methods

Core interactions must work with mouse, trackpad, touch, and keyboard. Drag-and-drop is never the only path for a state-changing action.

### 18.3 Accessibility baseline

Target WCAG 2.2 AA for MVP behavior, including:

- keyboard navigability;
- visible focus indicators;
- semantic controls;
- screen-reader labels;
- sufficient contrast;
- no color-only communication of meaningful state;
- accessible validation;
- predictable focus management;
- reduced-motion consideration;
- appropriate touch-target sizing.

### 18.4 Browser support

Support current mainstream Chrome, Edge, Firefox, and Safari, targeting the latest two stable major versions where versioning permits. Mobile support includes contemporary iOS/iPadOS Safari and Android Chrome.

Unavailable optional browser capabilities, particularly notifications, must degrade gracefully.

## 19. Reliability and Data Integrity Requirements

### 19.1 Timer correctness

Elapsed focus time must be derived from persisted timestamps, not rendered timer ticks. Background-tab throttling, UI stalls, refreshes, or navigation must not meaningfully change recorded duration.

### 19.2 Server/client timer authority

When online, the persisted server session is durable authority. The client may keep minimal local recovery state. Conflicting states require explicit reconciliation when silent merging could cause data loss.

### 19.3 Transactional domain actions

Operations that affect multiple pieces of state must succeed or fail coherently.

Example Start Focus operation:

```text
validate ownership
-> validate task state
-> validate active session invariant
-> locate active column
-> validate WIP
-> move task if necessary
-> create focus session
-> commit
```

If hard WIP validation fails, neither the task move nor focus session is created.

### 19.4 Multi-tab/device concurrency

Although MVP is single-user, an account may be open in multiple tabs/devices. The server must enforce critical invariants, especially one unfinished focus session per account.

### 19.5 Network failures

Ordinary mutations need clear saving/saved/error states. The UI must not claim a change is durable when the server rejected it.

Optimistic UI is allowed only when failure can reliably roll back or reconcile.

Timer behavior follows the stronger recovery rules above.

## 20. Performance and Capacity Targets

Taskfella should feel immediate for typical personal-project usage. Primary interactions such as task creation, movement, editing, focus controls, completion, and filtering should avoid full-page reloads.

Board rendering should prioritize visible content and active timer state. Large historical completed sets may use pagination, incremental loading, or virtualization.

Analytics should aggregate efficiently rather than downloading all raw history to the browser solely to draw charts.

Practical design capacity target:

- approximately 100 active/archived projects per account;
- approximately 10,000 retained tasks;
- approximately 50,000 time records.

These are architecture targets, not normal daily board-size expectations.

## 21. Security and Privacy Requirements

### 21.1 Authorization

All authenticated data access enforces ownership server-side. Client-supplied IDs are never sufficient authorization.

### 21.2 Baseline security

Requirements include:

- TLS in production;
- secure password hashing;
- secure session/token handling;
- CSRF protection where applicable;
- server-side input validation;
- output encoding;
- Markdown sanitization;
- rate limiting on sensitive authentication operations;
- secure OAuth flow handling;
- no production secrets in client bundles or source control.

### 21.3 Markdown trust boundary

User Markdown is parsed as the allowed subset and sanitized before rendering. Raw HTML/script execution and unsafe URL schemes are not permitted.

### 21.4 Privacy

Routine logs/telemetry should avoid capturing task descriptions, personal notes, passwords, authentication tokens, or raw export contents unless strictly required for an explicit user action.

## 22. Time and Date Correctness

Persist exact timestamps in UTC and use timezone-aware date/time logic for account-local calculations.

Date-only due dates remain calendar dates, not UTC instants, so they do not shift across timezone conversion.

Timezone logic must correctly handle daylight-saving transitions where relevant.

Weeks are Monday through Sunday.

## 23. Observability and Operational Support

Production operations should collect enough technical telemetry to diagnose failures without exposing user content.

Monitor at least:

- application errors;
- request failures;
- authentication failures/anomalies;
- timer persistence/reconciliation failures;
- export failures;
- analytics aggregation failures;
- background-job failures if background jobs are introduced;
- latency and availability.

Use technical correlation identifiers where useful while minimizing personal content.

## 24. Recommended Application Architecture

### 24.1 Architecture style

Use a **modular monolith** for MVP, backed by one primary relational datastore.

Logical application modules:

- Auth / Account;
- Projects / Boards;
- Tasks / Notes / Subtasks;
- Workflow / WIP;
- Focus / Pomodoro;
- Time Records / Interruptions;
- Analytics;
- Export.

This avoids premature microservices while preserving clear boundaries that can evolve independently.

### 24.2 High-level shape

```text
Responsive Web Client
        |
       HTTPS
        v
Taskfella Application/API
├── Auth / Account
├── Projects / Boards
├── Tasks / Notes / Subtasks
├── Workflow / WIP
├── Focus / Pomodoro
├── Time / Interruptions
├── Analytics
└── Export
        |
        v
Relational Database

External dependencies:
- Google OAuth
- email delivery for verification/reset
- browser notification capability
```

Depending on framework choice, web frontend and application/API may deploy together.

MVP should not require Kubernetes, service mesh, event streaming, multiple primary databases, a dedicated search cluster, or a dedicated analytics warehouse.

## 25. Core Data Model

### 25.1 Account

Conceptual fields:

- id;
- name;
- email;
- timezone;
- appearance;
- notification/sound preferences;
- Pomodoro configuration;
- created/updated timestamps.

Authentication provider credentials/linkage may be modeled separately from profile/preferences.

### 25.2 Project

Conceptual fields:

- id;
- owner_account_id;
- name;
- description;
- lifecycle state;
- position;
- created/updated timestamps;
- archived_at when archived.

### 25.3 Column

Conceptual fields:

- id;
- project_id;
- name;
- semantic_role;
- position;
- wip_mode;
- wip_limit;
- group_completed_by_date.

### 25.4 Swimlane

Conceptual fields:

- id;
- project_id;
- name;
- position.

### 25.5 Label

Labels belong to one project. Task-to-label is many-to-many.

### 25.6 Task

Conceptual fields:

- id;
- project_id;
- column_id;
- optional swimlane_id;
- title;
- description;
- optional color;
- optional due_date;
- position;
- created_at;
- optional completed_at;
- optional deleted_at;
- updated_at.

### 25.7 Task lifecycle events

Store lightweight internal events for meaningful completion/reopen transitions. This is not the future user-facing Task History feature and does not require recording every edit or reorder.

### 25.8 Subtask

Conceptual fields:

- id;
- task_id;
- text;
- is_completed;
- position.

### 25.9 Note

Conceptual fields:

- id;
- task_id;
- body;
- created_at;
- updated_at.

### 25.10 FocusSession

Represents live/recoverable focus state.

Conceptual fields:

- id;
- account_id;
- task_id;
- started_at;
- target_duration;
- optional target_reached_at;
- optional ended_at;
- status (`running`, `paused`, `ended`);
- created_at.

A break is distinct from task focus and must never count as focus time. It may use a separate break-session representation or equivalent account-level timer state.

### 25.11 Interruption

Conceptual fields:

- id;
- focus_session_id;
- optional reason;
- paused_at;
- optional resumed_at;
- paused_duration.

### 25.12 TimeRecord

Represents finalized historical work used for analytics/export.

Conceptual fields:

- id;
- account_id;
- project_id;
- task_id;
- source (`pomodoro` or `manual`);
- started_at;
- ended_at;
- focus_duration;
- paused_duration;
- overtime_duration;
- completed_pomodoro;
- created_at;
- updated_at.

A timer-based FocusSession produces a TimeRecord when finalized. Manual time creates a TimeRecord directly.

Project/task references on a TimeRecord must remain consistent.

## 26. Domain Operations and Trust Boundaries

The API/application boundary owns authorization, workflow invariants, timer invariants, destructive semantics, and canonical analytics definitions.

Model important user actions as explicit domain operations rather than unrestricted field updates, for example:

- `startFocus(task)`;
- `moveTask(task, destination)`;
- `completeTask(task)`;
- `reopenTask(task)`;
- `changeColumnRole(column, role)`;
- `archiveProject(project)`;
- `restoreTask(task)`;
- `deleteTimeRecord(record)`.

This is necessary because movement, completion, WIP, focus finalization, and lifecycle timestamps are coupled business rules.

The browser is an untrusted client. It may provide immediate validation for usability, but the server revalidates ownership and business rules before committing state.

## 27. Analytics Architecture

Home and Analytics consume one canonical metric domain implementation.

```text
Time Records ────────┐
Interruptions ───────┼──> Metric calculation ──> Home
Tasks/Projects ──────┘                         └─> Analytics
```

Use the primary relational datastore and application aggregation for MVP. Do not introduce a separate analytics service/warehouse by default.

If scale later requires cached summaries or materialized aggregates, source records remain authoritative.

## 28. Search Architecture

MVP search covers title, description, subtask text, and note body.

For personal-scale data, use the primary datastore's supported search capabilities. A dedicated search service such as Elasticsearch/OpenSearch is unnecessary for MVP.

## 29. External Dependencies

Keep dependencies narrow:

- Google OAuth;
- email delivery for verification/password reset;
- browser notification capability.

Not required in MVP:

- public API;
- webhooks;
- calendar sync;
- cloud-file integrations;
- team chat integrations;
- external automation platforms.

## 30. Core Release Verification Scenarios

Before MVP release, verify at minimum:

1. Start focus -> refresh page -> timer remains correct.
2. Start focus -> close/reopen browser -> session recovers.
3. Start focus -> temporarily lose network -> local display continues and reconciles safely.
4. Start focus in one tab -> attempt another session in another tab/device -> invariant remains one active session.
5. Start Focus on a task outside the active column -> WIP behavior is respected transactionally.
6. Move a focused task into a completed column -> focus finalizes, time saves, task completes, no automatic break.
7. Pause/resume multiple times -> interruption count, paused duration, and Focus Ratio remain correct.
8. Reach target and continue overtime -> exactly one Pomodoro is recorded for that session.
9. Add/edit/delete manual time -> analytics recalculates.
10. Edit/delete a timer-generated time record -> analytics recalculates.
11. Change account timezone -> dates/grouping recalculate without changing stored instants.
12. Archive/restore a project -> Home actionability and historical analytics remain correct.
13. Trash/restore a task -> board visibility and analytics retention remain correct.
14. Permanently delete historical task/project data -> analytics contribution disappears.
15. Generate project and all-project exports -> retained data scope is complete and deterministic.
16. Complete the daily loop on desktop using keyboard only.
17. Complete the daily loop on mobile without relying on cross-column drag-and-drop.
18. Verify major routes in light/dark modes, reduced-motion preference, browser zoom, and long-content states.

## 31. MVP Scope Boundary

The MVP includes the complete personal execution loop and the features needed to make it trustworthy.

Explicit non-goals:

- team collaboration;
- project sharing;
- roles/permissions;
- assignees;
- recurring tasks;
- task dependencies/cross-board relationships;
- timeline/Gantt;
- file attachments;
- custom fields;
- task estimates;
- CSV import;
- public API;
- webhooks;
- third-party integrations;
- offline-first editing;
- advanced flow analytics;
- forecasting;
- workload planning.

A feature proposed during implementation belongs in MVP only when it is required for the approved daily loop, correctness/security/data integrity, responsive/accessibility parity, or usability of an already-approved feature. Otherwise, defer it.

## 32. Future Roadmap

### 32.1 Task and project capabilities

Potential future additions:

- recurring tasks;
- attachments;
- custom fields;
- task estimates;
- cross-board relationships;
- timeline/Gantt.

### 32.2 Collaboration

Potential future additions:

- project sharing;
- members;
- assignees;
- roles and permissions;
- participant comments;
- realtime updates;
- richer activity history.

Personal notes in MVP should not automatically become team comments; that evolution should be a deliberate product decision.

### 32.3 Flow/system analytics

Potential future analytics:

- Cumulative Flow Diagram;
- Cycle Time;
- Lead Time;
- Throughput;
- Burndown;
- Calendar;
- workload/task-count views;
- board history;
- task history;
- Monte Carlo forecasting.

Personal analytics answers **how the user is focusing**. Future flow analytics answers **how work is moving**.

### 32.4 Integrations evolution

Recommended direction:

```text
CSV export
-> CSV import template
-> CSV import
-> public API
-> webhooks / integrations
```

The roadmap is directional, not a committed version schedule.

## 33. Final Design Principles

1. **Board state is workflow state.** Avoid duplicate task-status truth when the column semantic role already expresses it.
2. **Focus is part of execution, not a disconnected utility.** Start Focus interacts with active workflow state and WIP.
3. **Actual time and Pomodoro completion are separate concepts.** A long session may have one Pomodoro but more actual focus time.
4. **Home and Analytics share metric definitions.** The same source data must produce the same result for the same scope and period.
5. **Archive/Trash preserve history; permanent delete removes it.** Data lifecycle semantics must remain predictable.
6. **Mobile changes interaction, not capability.** Core workflow actions remain available without desktop drag gestures.
7. **The server owns invariants.** Frontend validation improves UX but is not authoritative.
8. **Prefer the simplest maintainable architecture.** Start with a modular monolith and relational datastore; add infrastructure only when evidence requires it.
9. **YAGNI applies to roadmap features.** Do not allow future ideas to blur the MVP contract.
10. **Taskfella may simplify features, but not correctness.** Timer, workflow, deletion, timezone, and analytics behavior must be trustworthy.
