---
version: alpha
name: Taskfella Calm Execution
description: A calm, board-first design system for personal project execution, contextual focus, time tracking, and trustworthy analytics.
colors:
  primary: "#0F766E"
  primary-hover: "#0B514C"
  primary-soft: "#DFF2ED"
  on-primary: "#FFFFFF"
  on-primary-soft: "#0B514C"
  ink: "#17211F"
  muted: "#5F706B"
  paper: "#F6F8F4"
  surface: "#FFFFFF"
  surface-subtle: "#EEF2EF"
  line: "#DCE5DF"
  line-strong: "#B9C9C1"
  focus: "#F2A65A"
  success: "#176B51"
  success-soft: "#DFF2ED"
  warning: "#9A5E16"
  warning-soft: "#FFF0CE"
  danger: "#A23B35"
  danger-soft: "#FCE8E6"
  dark-paper: "#101816"
  dark-surface: "#17211F"
  dark-surface-subtle: "#1F2C29"
  dark-line: "#31413D"
  dark-ink: "#EDF5F1"
  dark-muted: "#AABAB4"
typography:
  display-lg:
    fontFamily: "Arial, Helvetica, sans-serif"
    fontSize: 72px
    fontWeight: 750
    lineHeight: 0.98
    letterSpacing: -0.07em
  display-md:
    fontFamily: "Arial, Helvetica, sans-serif"
    fontSize: 48px
    fontWeight: 750
    lineHeight: 1
    letterSpacing: -0.055em
  headline-lg:
    fontFamily: "Arial, Helvetica, sans-serif"
    fontSize: 32px
    fontWeight: 750
    lineHeight: 1.08
    letterSpacing: -0.045em
  headline-md:
    fontFamily: "Arial, Helvetica, sans-serif"
    fontSize: 24px
    fontWeight: 750
    lineHeight: 1.15
    letterSpacing: -0.03em
  title-md:
    fontFamily: "Arial, Helvetica, sans-serif"
    fontSize: 18px
    fontWeight: 750
    lineHeight: 1.3
    letterSpacing: -0.02em
  body-lg:
    fontFamily: "Arial, Helvetica, sans-serif"
    fontSize: 18px
    fontWeight: 400
    lineHeight: 1.55
  body-md:
    fontFamily: "Arial, Helvetica, sans-serif"
    fontSize: 16px
    fontWeight: 400
    lineHeight: 1.5
  body-sm:
    fontFamily: "Arial, Helvetica, sans-serif"
    fontSize: 14px
    fontWeight: 400
    lineHeight: 1.45
  label-md:
    fontFamily: "Arial, Helvetica, sans-serif"
    fontSize: 14px
    fontWeight: 750
    lineHeight: 1.2
  label-sm:
    fontFamily: "Arial, Helvetica, sans-serif"
    fontSize: 12px
    fontWeight: 750
    lineHeight: 1.2
    letterSpacing: 0.04em
  eyebrow:
    fontFamily: "Arial, Helvetica, sans-serif"
    fontSize: 12px
    fontWeight: 800
    lineHeight: 1.2
    letterSpacing: 0.14em
  metric-lg:
    fontFamily: "Arial, Helvetica, sans-serif"
    fontSize: 32px
    fontWeight: 800
    lineHeight: 1
    letterSpacing: -0.045em
  timer-lg:
    fontFamily: "Arial, Helvetica, sans-serif"
    fontSize: 56px
    fontWeight: 800
    lineHeight: 1
    letterSpacing: -0.06em
rounded:
  xs: 6px
  sm: 8px
  md: 10px
  lg: 13px
  xl: 18px
  modal: 20px
  full: 9999px
spacing:
  micro: 4px
  xs: 6px
  sm: 8px
  md: 12px
  lg: 16px
  xl: 20px
  2xl: 24px
  3xl: 32px
  4xl: 48px
  5xl: 64px
  desktop-gutter: 24px
  mobile-gutter: 16px
  sidebar-width: 224px
  content-max: 1440px
  touch-target: 44px
components:
  application-canvas:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
  divider:
    backgroundColor: "{colors.line}"
    size: 1px
  strong-divider:
    backgroundColor: "{colors.line-strong}"
    size: 1px
  status-success:
    backgroundColor: "{colors.success-soft}"
    textColor: "{colors.success}"
    typography: "{typography.label-sm}"
    rounded: "{rounded.full}"
    padding: 5px 9px
  status-warning:
    backgroundColor: "{colors.warning-soft}"
    textColor: "{colors.warning}"
    typography: "{typography.label-sm}"
    rounded: "{rounded.full}"
    padding: 5px 9px
  status-danger:
    backgroundColor: "{colors.danger-soft}"
    textColor: "{colors.danger}"
    typography: "{typography.label-sm}"
    rounded: "{rounded.full}"
    padding: 5px 9px
  dark-canvas:
    backgroundColor: "{colors.dark-paper}"
    textColor: "{colors.dark-ink}"
  dark-card:
    backgroundColor: "{colors.dark-surface}"
    textColor: "{colors.dark-ink}"
    rounded: "{rounded.lg}"
    padding: "{spacing.lg}"
  dark-column:
    backgroundColor: "{colors.dark-surface-subtle}"
    textColor: "{colors.dark-ink}"
    rounded: "{rounded.lg}"
    padding: "{spacing.md}"
  dark-divider:
    backgroundColor: "{colors.dark-line}"
    size: 1px
  dark-secondary-text:
    backgroundColor: "{colors.dark-surface}"
    textColor: "{colors.dark-muted}"
    typography: "{typography.body-sm}"
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    typography: "{typography.label-md}"
    rounded: "{rounded.sm}"
    height: "{spacing.touch-target}"
    padding: 0 16px
  button-primary-hover:
    backgroundColor: "{colors.primary-hover}"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.primary-hover}"
    typography: "{typography.label-md}"
    rounded: "{rounded.sm}"
    height: "{spacing.touch-target}"
    padding: 0 16px
  input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    typography: "{typography.body-md}"
    rounded: "{rounded.sm}"
    height: "{spacing.touch-target}"
    padding: 12px 13px
  card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.lg}"
    padding: "{spacing.lg}"
  card-elevated:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.xl}"
    padding: "{spacing.2xl}"
  sidebar-item:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.muted}"
    typography: "{typography.label-md}"
    rounded: "{rounded.sm}"
    height: "{spacing.touch-target}"
    padding: 0 12px
  sidebar-item-active:
    backgroundColor: "{colors.primary-soft}"
    textColor: "{colors.primary-hover}"
  task-card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "{spacing.md}"
  board-column:
    backgroundColor: "{colors.surface-subtle}"
    textColor: "{colors.ink}"
    rounded: "{rounded.lg}"
    padding: "{spacing.md}"
  status-chip:
    backgroundColor: "{colors.primary-soft}"
    textColor: "{colors.primary-hover}"
    typography: "{typography.label-sm}"
    rounded: "{rounded.full}"
    padding: 5px 9px
  metric-card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.lg}"
    padding: "{spacing.lg}"
  detail-panel:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.lg}"
    padding: "{spacing.xl}"
  dialog:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.modal}"
    padding: "{spacing.2xl}"
  focus-ring:
    backgroundColor: "{colors.focus}"
    rounded: "{rounded.xs}"
    width: 3px
---

## Overview

Taskfella is a calm command center for personal execution. Its personality is focused, trustworthy, lightly editorial, and quietly warm rather than corporate, playful, or aggressively gamified. The product should help one person move from planning to focused action without feeling watched, hurried, or overloaded.

The primary visual anchor is **board-first clarity** balanced with **focus-first calm**. Dense work surfaces such as Kanban boards must remain scan-friendly, while authentication, focus, settings, and destructive flows use more breathing room. Analytics should clarify patterns without turning personal productivity into a competitive scoreboard.

The experience hierarchy is consistent across desktop and mobile:

1. Enter securely through authentication.
2. Use Home as a concise launchpad.
3. Open a project directly into its board.
4. Inspect and move work without losing board context.
5. Start Focus from the task and keep the timer globally available.
6. Review canonical time and focus patterns in Analytics.
7. Control preferences, exports, and data lifecycle in Settings.

## Colors

The palette uses warm paper, clean white surfaces, deep green-black ink, and one teal interaction color. Teal communicates action, active state, and focused progress. Orange is reserved for keyboard focus visibility and must not become decorative noise.

- **Primary teal (`#0F766E`):** primary actions, active navigation, active focus, selected controls, and meaningful chart emphasis.
- **Primary hover (`#0B514C`):** hovered/pressed actions and dark teal text on soft teal backgrounds.
- **Paper (`#F6F8F4`):** the warm application background. Prefer this over cold gray or pure white canvases.
- **Surface (`#FFFFFF`):** cards, panels, dialogs, forms, and board task cards.
- **Ink (`#17211F`):** headings and body copy; never use pure black as the default text color.
- **Muted (`#5F706B`):** secondary copy and metadata. Do not use for essential low-size text unless contrast remains WCAG AA.
- **Line (`#DCE5DF`):** quiet component boundaries and dividers.
- **Focus orange (`#F2A65A`):** visible focus rings only; it must remain obvious in both light and dark modes.
- **Success, warning, danger:** semantic feedback only. Never rely on color alone; pair with text and/or an icon.

Light mode is the default concept. Dark mode preserves the hierarchy rather than inverting every color mechanically: dark paper at `#101816`, dark surfaces at `#17211F`, light text at `#EDF5F1`, and teal actions adjusted only when contrast requires it.

Charts use teal as the primary series and semantic colors only where the meaning is explicit. Avoid rainbow dashboards.

## Typography

Use Arial with Helvetica and system sans-serif fallbacks to match Taskfella's current implementation and keep rendering dependable without a font service. Typography feels direct and editorial through strong weight, compact headline line-height, and restrained negative letter spacing.

- **Display:** marketing or empty-state moments only. Product pages should normally begin with `headline-lg` or `headline-md`.
- **Headlines:** bold, compact, and sentence case. Avoid all-caps headings.
- **Body:** comfortable 16px default with 1.5 line-height.
- **Labels:** 12–14px, bold enough to scan in dense work surfaces.
- **Eyebrows:** uppercase and widely tracked, used sparingly for section context—not every card.
- **Metrics and timers:** tabular-feeling, bold numerals with tight tracking. Timer text is the visual center only during active focus.

Never reduce interactive labels below 12px or body text below 14px. Long task titles wrap rather than shrink or truncate important meaning.

## Layout

Use a responsive application shell with a maximum content width of 1440px, a 224px desktop sidebar, 24px desktop gutters, and 16px mobile gutters. The base rhythm follows 4px/8px increments.

Desktop and large tablet:

- Persistent left navigation for Home, Projects, Analytics, and Settings.
- Multi-column Kanban board with horizontal room prioritized over decorative margins.
- Task details open in a right-side panel so the board remains visible.
- Global timer appears as a compact persistent control in the shell when focus or break state exists.

Mobile:

- One board column at a time with tabs, selector, or equivalent compact navigation.
- Explicit **Move to…** controls replace required cross-column drag gestures.
- Task details open full-screen or as a sheet.
- Primary actions remain reachable without precise pointer input.
- Bottom navigation may replace the desktop sidebar while preserving the same information architecture.

All layout grids use `minmax(0, 1fr)` behavior so long task names, project names, status text, and localization never create horizontal overflow. Minimum touch target is 44px. At 200% browser zoom, essential actions remain visible and operable without two-dimensional page scrolling.

## Elevation & Depth

Taskfella uses **tonal layering** before shadow. Paper forms the canvas, white surfaces establish containment, and borders define most component edges.

- Standard cards: 1px line border with either no shadow or a very soft `0 4px 12px rgba(23, 33, 31, 0.04)` shadow.
- Elevated panels and authentication cards: `0 22px 60px rgba(23, 33, 31, 0.08)`.
- Side panels and dialogs: stronger directional shadow only when needed to separate overlapping layers.
- Avoid glassmorphism on data-dense screens. A light backdrop blur is acceptable only for sticky global chrome over content.
- Hover elevation is subtle: at most 1px translation or a small shadow increase. Reduced-motion preferences remove translation.

## Shapes

Shapes are calm and approachable, not bubbly.

- Inputs and buttons: 8px radius.
- Task cards: 10px radius.
- Board columns, metric cards, and standard panels: 13px radius.
- Authentication cards and elevated feature panels: 18px radius.
- Dialogs: 20px radius.
- Status chips and counters: full pill radius.
- Brand mark: a compact rounded square, not a circle.

Do not apply full-pill styling to ordinary buttons, fields, or cards. Reserve it for statuses, labels, counts, and compact filters.

## Components

### Application shell

The shell provides brand, responsive navigation, account access, and global timer continuity. Home is the post-login launchpad, while opening a project routes directly to the board. Keep navigation labels explicit; icon-only navigation requires accessible names and visible tooltips.

### Authentication

Authentication uses a centered, narrow card on warm paper with the Taskfella mark above it. Forms include persistent labels, clear requirements, one obvious primary action, and secondary recovery links. Success, invalid input, verification required, expired token, used token, rate-limited, and safe generic failures need distinct text states without revealing account existence.

### Buttons

Primary buttons use teal with white text. Secondary buttons use white with a teal-gray border and dark teal text. Destructive buttons use danger red only after the user reaches a clearly destructive context. Disabled state must remain legible and must not be the only indication that work is in progress.

### Inputs and forms

Use persistent visible labels above fields. Focus combines a teal border with a 3px visible ring. Validation appears near the relevant field and in an accessible summary when multiple fields fail. Do not use placeholder text as a label.

### Home

Home is concise: four canonical metrics, active or resumable focus, due/overdue previews, and project cards. It is not a second board. Project cards show open work, completed today, and focus time today without fabricated completion percentages.

### Board and columns

Columns are soft tonal containers holding white task cards. Header content includes the user-defined name, count, semantic/WIP context when needed, and an overflow menu. The active column is communicated semantically, not merely by a special color. Desktop supports drag-and-drop plus non-drag actions; mobile always exposes explicit movement controls.

### Task cards

Task cards prioritize title, due state, labels, checklist progress, and compact focus/time context. Color is user-selected decoration and never silently means priority or status. Active focus uses a teal edge and explicit text/icon. Cards must remain understandable without color.

### Task details

Desktop details use a right-side panel with sections or tabs for Details, Checklist, Notes, and Time. Start Focus remains prominent but does not obscure editing. Mobile details use a full-screen route or sheet. Long Markdown and notes scroll within a predictable reading area.

### Focus timer

The timer gives the remaining target or overtime the strongest numeric emphasis, followed by task and project context. Pause, resume, stop/save, and break choices are explicit. Pausing first stops accumulation and then requests an interruption reason. The global compact timer is always a route back to the active task.

### Metrics and analytics

Metric cards use shared definitions across Home and Analytics. Charts have descriptive titles, visible axes or labels, text summaries, keyboard-accessible data, and no-data states. Teal is the primary series; interruption breakdowns can use tonal teal or restrained semantic colors.

### Settings and data lifecycle

Settings use clear sections: Account, Pomodoro, Appearance, Notifications, Timezone, and Data & Privacy. Forms expose saving, saved, and error states. Archive, Trash, permanent deletion, project deletion, and account deletion use different language and visual treatment. Destructive confirmation names exactly what will happen.

### Responsive and accessibility states

Every critical workflow supports mouse, touch, keyboard, and screen reader use. Visible focus is mandatory. Dragging always has a non-drag alternative. Motion is brief and functional, and reduced-motion preferences remove nonessential transitions. Loading states preserve layout where possible; errors explain recovery rather than only reporting failure.

## Do's and Don'ts

### Do

- Keep the Kanban board the primary project surface.
- Keep Pomodoro and time controls attached to task context.
- Use warm paper, white surfaces, deep ink, and restrained teal.
- Make state explicit with text, icon, and structure—not color alone.
- Use generous space on authentication/focus screens and efficient density on boards.
- Preserve the same capability on mobile while changing the interaction model.
- Use canonical Home/Analytics metric definitions and clear no-data states.
- Design empty, loading, saving, saved, offline/recovery, permission, and error states.
- Respect WCAG 2.2 AA contrast, 44px touch targets, keyboard flow, reduced motion, and 200% zoom.

### Don't

- Do not turn Home into another task board.
- Do not separate the timer into an unrelated utility experience.
- Do not require drag-and-drop for movement or reordering.
- Do not use rainbow colors, heavy gradients, or gamified productivity scores.
- Do not use decorative glass effects on dense data surfaces.
- Do not infer task priority or workflow meaning from a user-selected card color.
- Do not hide field labels inside placeholders.
- Do not make destructive lifecycle actions look interchangeable.
- Do not expose personal notes, passwords, tokens, or provider secrets in UI diagnostics.
- Do not add collaboration, assignees, notifications feeds, or other non-MVP surfaces.
