import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { type Database } from "@/server/db/client";
import {
  columns,
  labels,
  projectLifecycleEvents,
  projects,
  swimlanes,
  type Label,
  type Project,
  type ProjectColumn,
  type ProjectLifecycleEvent,
  type Swimlane,
} from "@/server/db/schema";
import { AppError } from "@/server/http/errors";
import { isUniqueConstraintViolation } from "@/server/modules/auth/accounts";
import {
  BLANK_COLUMNS,
  completionMeaningChanges,
  normalizeColor,
  normalizeColumnName,
  normalizeCompletedGrouping,
  normalizeLabelName,
  normalizePosition,
  normalizeProjectDescription,
  normalizeProjectName,
  normalizeProjectTemplate,
  normalizeRole,
  normalizeSwimlaneName,
  normalizeUuid,
  normalizeWipLimit,
  normalizeWipMode,
  normalizedLabelName,
  requireCompletionConfirmation,
  TEMPLATE_COLUMNS,
  type ColumnDraft,
  type ColumnRole,
  type CompletedGrouping,
  type ProjectCreateInput,
  type ProjectPatchInput,
  type ProjectTemplate,
  type WipMode,
  validateColumnDrafts,
} from "./types";

type ProjectTransaction = Parameters<Parameters<Database["transaction"]>[0]>[0];
type ProjectDatabase = Database | ProjectTransaction;

export interface ProjectSnapshot {
  project: Project;
  columns: ProjectColumn[];
  swimlanes: Swimlane[];
  labels: Label[];
  lifecycle: ProjectLifecycleEvent[];
}

export interface ColumnPatch {
  name?: unknown;
  role?: unknown;
  position?: unknown;
  wipMode?: unknown;
  wipLimit?: unknown;
  completedGrouping?: unknown;
}

export interface ColumnConfigurationOptions {
  expectedRevision?: number;
  confirmCompletionChanges?: boolean;
}

export interface BoardMutationOptions {
  expectedRevision?: number;
}

export interface SwimlanePatch {
  name?: unknown;
  position?: unknown;
}

export interface LabelPatch {
  name?: unknown;
  color?: unknown;
  position?: unknown;
}

export function templateColumns(template: ProjectTemplate): ColumnDraft[] {
  const source = template === "blank" ? BLANK_COLUMNS : TEMPLATE_COLUMNS[template];
  return source.map((column) => ({ ...column }));
}

function assertRevision(expectedRevision: number | undefined, currentRevision: number): void {
  if (expectedRevision !== undefined && expectedRevision !== currentRevision) {
    throw new AppError("CONCURRENT_UPDATE");
  }
}

async function lockAccountOrder(db: ProjectDatabase, accountId: string): Promise<void> {
  await db.execute(
    sql`SELECT pg_advisory_xact_lock(hashtext(${`taskfella-project-order:${accountId}`}))`,
  );
}

async function normalizeActiveProjectPositions(
  db: ProjectDatabase,
  accountId: string,
  now: Date,
): Promise<void> {
  const activeProjects = await db
    .select()
    .from(projects)
    .where(and(eq(projects.accountId, accountId), eq(projects.status, "active")))
    .orderBy(asc(projects.position), asc(projects.createdAt))
    .for("update");
  for (const [position, project] of activeProjects.entries()) {
    if (project.position !== position) {
      await db
        .update(projects)
        .set({ position, updatedAt: now })
        .where(eq(projects.id, project.id));
    }
  }
}

async function lockProjectRow(
  db: ProjectDatabase,
  accountId: string,
  projectId: string,
): Promise<Project> {
  const normalizedProjectId = normalizeUuid(projectId);
  await db.execute(
    sql`SELECT pg_advisory_xact_lock(hashtext(${`taskfella-workflow:${normalizedProjectId}`}))`,
  );
  const [project] = await db
    .select()
    .from(projects)
    .where(and(eq(projects.id, normalizedProjectId), eq(projects.accountId, accountId)))
    .for("update");
  if (!project) throw new AppError("NOT_FOUND");
  return project;
}

async function getOwnedProject(
  db: ProjectDatabase,
  accountId: string,
  projectId: string,
): Promise<Project> {
  const normalizedProjectId = normalizeUuid(projectId);
  const [project] = await db
    .select()
    .from(projects)
    .where(and(eq(projects.id, normalizedProjectId), eq(projects.accountId, accountId)))
    .limit(1);
  if (!project) throw new AppError("NOT_FOUND");
  return project;
}

function assertUniqueNames(names: string[]): void {
  const seen = new Set<string>();
  for (const name of names) {
    const normalized = name.normalize("NFKC").toLocaleLowerCase("en-US");
    if (seen.has(normalized)) throw new AppError("INVALID_REQUEST");
    seen.add(normalized);
  }
}

function normalizeCreateColumns(input: ProjectCreateInput): ColumnDraft[] {
  const template = normalizeProjectTemplate(input.template);
  if (!input.columns) return validateColumnDrafts(templateColumns(template));
  if (template !== "blank") throw new AppError("INVALID_REQUEST");
  const drafts = input.columns.map((column, index) => {
    const role = normalizeRole(column.role);
    const wipMode = normalizeWipMode(column.wipMode);
    return {
      name: normalizeColumnName(column.name),
      role,
      position: index,
      wipMode,
      wipLimit: normalizeWipLimit(column.wipLimit, wipMode),
      completedGrouping: normalizeCompletedGrouping(column.completedGrouping),
    };
  });
  return validateColumnDrafts(drafts);
}

function projectPayload(snapshot: ProjectSnapshot) {
  return {
    ...snapshot.project,
    columns: snapshot.columns,
    swimlanes: snapshot.swimlanes,
    labels: snapshot.labels,
    lifecycle: snapshot.lifecycle,
    workflow: {
      columns: snapshot.columns,
      swimlanes: snapshot.swimlanes,
      labels: snapshot.labels,
    },
  };
}

export function serializeProject(snapshot: ProjectSnapshot) {
  return projectPayload(snapshot);
}

async function getProjectSnapshot(
  db: ProjectDatabase,
  accountId: string,
  projectId: string,
): Promise<ProjectSnapshot> {
  const normalizedProjectId = normalizeUuid(projectId);
  const project = await getOwnedProject(db, accountId, normalizedProjectId);
  const [projectColumns, projectSwimlanes, projectLabels, lifecycle] = await Promise.all([
    db
      .select()
      .from(columns)
      .where(eq(columns.projectId, normalizedProjectId))
      .orderBy(asc(columns.position), asc(columns.createdAt)),
    db
      .select()
      .from(swimlanes)
      .where(eq(swimlanes.projectId, normalizedProjectId))
      .orderBy(asc(swimlanes.position), asc(swimlanes.createdAt)),
    db
      .select()
      .from(labels)
      .where(eq(labels.projectId, normalizedProjectId))
      .orderBy(asc(labels.position), asc(labels.createdAt)),
    db
      .select()
      .from(projectLifecycleEvents)
      .where(eq(projectLifecycleEvents.projectId, normalizedProjectId))
      .orderBy(asc(projectLifecycleEvents.createdAt)),
  ]);
  return {
    project,
    columns: projectColumns,
    swimlanes: projectSwimlanes,
    labels: projectLabels,
    lifecycle,
  };
}

export async function getConsistentProjectSnapshot(
  db: Database,
  accountId: string,
  projectId: string,
): Promise<ProjectSnapshot> {
  return db.transaction((tx) => getProjectSnapshot(tx, accountId, projectId), {
    isolationLevel: "repeatable read",
    accessMode: "read only",
  });
}

export async function listProjects(db: ProjectDatabase, accountId: string): Promise<Project[]> {
  return db
    .select()
    .from(projects)
    .where(eq(projects.accountId, accountId))
    .orderBy(asc(projects.status), asc(projects.position), desc(projects.updatedAt));
}

export async function createProject(
  db: Database,
  accountId: string,
  rawInput: ProjectCreateInput,
  now = new Date(),
): Promise<ProjectSnapshot> {
  const name = normalizeProjectName(rawInput.name);
  const description = normalizeProjectDescription(rawInput.description);
  const template = normalizeProjectTemplate(rawInput.template);
  const drafts = normalizeCreateColumns({ ...rawInput, template });

  return db.transaction(async (tx) => {
    await lockAccountOrder(tx, accountId);
    await normalizeActiveProjectPositions(tx, accountId, now);
    const [lastProject] = await tx
      .select({ position: projects.position })
      .from(projects)
      .where(and(eq(projects.accountId, accountId), eq(projects.status, "active")))
      .orderBy(desc(projects.position))
      .limit(1);
    const [project] = await tx
      .insert(projects)
      .values({
        accountId,
        name,
        description,
        status: "active",
        position: (lastProject?.position ?? -1) + 1,
        revision: 0,
        createdAt: now,
        updatedAt: now,
      })
      .returning();
    if (!project) throw new Error("Project could not be created.");

    await tx.insert(columns).values(
      drafts.map((column) => ({
        projectId: project.id,
        name: column.name,
        role: column.role,
        position: column.position,
        wipMode: column.wipMode,
        wipLimit: column.wipLimit,
        completedGrouping: column.completedGrouping,
        createdAt: now,
        updatedAt: now,
      })),
    );
    await tx.insert(projectLifecycleEvents).values({
      projectId: project.id,
      accountId,
      event: "created",
      createdAt: now,
    });
    return getProjectSnapshot(tx, accountId, project.id);
  });
}

export async function updateProject(
  db: Database,
  accountId: string,
  projectId: string,
  rawPatch: ProjectPatchInput,
  now = new Date(),
): Promise<ProjectSnapshot> {
  const name = rawPatch.name === undefined ? undefined : normalizeProjectName(rawPatch.name);
  const description =
    rawPatch.description === undefined
      ? undefined
      : normalizeProjectDescription(rawPatch.description);

  return db.transaction(async (tx) => {
    const project = await lockProjectRow(tx, accountId, projectId);
    assertRevision(rawPatch.expectedRevision, project.revision);
    if (name === undefined && description === undefined) {
      return getProjectSnapshot(tx, accountId, projectId);
    }
    const [updated] = await tx
      .update(projects)
      .set({
        name: name ?? project.name,
        description: description ?? project.description,
        revision: sql`${projects.revision} + 1`,
        updatedAt: now,
      })
      .where(eq(projects.id, project.id))
      .returning();
    if (!updated) throw new Error("Project could not be updated.");
    return getProjectSnapshot(tx, accountId, projectId);
  });
}

export async function reorderProjects(
  db: Database,
  accountId: string,
  projectId: string,
  rawPosition: unknown,
): Promise<Project[]> {
  const normalizedProjectId = normalizeUuid(projectId);
  const position = normalizePosition(rawPosition, 0);
  return db.transaction(async (tx) => {
    await lockAccountOrder(tx, accountId);
    const ordered = await tx
      .select()
      .from(projects)
      .where(and(eq(projects.accountId, accountId), eq(projects.status, "active")))
      .orderBy(asc(projects.position), asc(projects.createdAt))
      .for("update");
    const currentIndex = ordered.findIndex((project) => project.id === normalizedProjectId);
    if (currentIndex < 0) throw new AppError("NOT_FOUND");
    const targetIndex = Math.min(position, ordered.length - 1);
    const [moved] = ordered.splice(currentIndex, 1);
    ordered.splice(targetIndex, 0, moved);
    for (const [index, project] of ordered.entries()) {
      if (project.position !== index) {
        await tx
          .update(projects)
          .set({ position: index, updatedAt: new Date() })
          .where(eq(projects.id, project.id));
      }
    }
    return ordered.map((project, index) => ({ ...project, position: index }));
  });
}

export async function archiveProject(
  db: Database,
  accountId: string,
  projectId: string,
  now = new Date(),
): Promise<ProjectSnapshot> {
  return db.transaction(async (tx) => {
    await lockAccountOrder(tx, accountId);
    const project = await lockProjectRow(tx, accountId, projectId);
    if (project.status === "active") {
      await tx
        .update(projects)
        .set({
          status: "archived",
          archivedAt: now,
          revision: sql`${projects.revision} + 1`,
          updatedAt: now,
        })
        .where(eq(projects.id, project.id));
      await tx.insert(projectLifecycleEvents).values({
        projectId: project.id,
        accountId,
        event: "archived",
        createdAt: now,
      });
    }
    await normalizeActiveProjectPositions(tx, accountId, now);
    return getProjectSnapshot(tx, accountId, project.id);
  });
}

export async function restoreProject(
  db: Database,
  accountId: string,
  projectId: string,
  now = new Date(),
): Promise<ProjectSnapshot> {
  return db.transaction(async (tx) => {
    await lockAccountOrder(tx, accountId);
    const project = await lockProjectRow(tx, accountId, projectId);
    await normalizeActiveProjectPositions(tx, accountId, now);
    if (project.status === "archived") {
      const [lastActive] = await tx
        .select({ position: projects.position })
        .from(projects)
        .where(and(eq(projects.accountId, accountId), eq(projects.status, "active")))
        .orderBy(desc(projects.position))
        .limit(1);
      await tx
        .update(projects)
        .set({
          status: "active",
          archivedAt: null,
          position: (lastActive?.position ?? -1) + 1,
          revision: sql`${projects.revision} + 1`,
          updatedAt: now,
        })
        .where(eq(projects.id, project.id));
      await tx.insert(projectLifecycleEvents).values({
        projectId: project.id,
        accountId,
        event: "restored",
        createdAt: now,
      });
    }
    return getProjectSnapshot(tx, accountId, projectId);
  });
}

export async function permanentlyDeleteProject(
  db: Database,
  accountId: string,
  projectId: string,
  confirmation: unknown,
): Promise<void> {
  if (typeof confirmation !== "string" || confirmation.length === 0) {
    throw new AppError("PERMANENT_DELETE_CONFIRMATION_REQUIRED");
  }
  await db.transaction(async (tx) => {
    await lockAccountOrder(tx, accountId);
    const project = await lockProjectRow(tx, accountId, projectId);
    if (confirmation !== project.name) {
      throw new AppError("PERMANENT_DELETE_CONFIRMATION_REQUIRED");
    }
    await tx.delete(projects).where(eq(projects.id, project.id));
    await normalizeActiveProjectPositions(tx, accountId, new Date());
  });
}

function draftFromColumn(
  column: ProjectColumn,
  patch: ColumnPatch,
  position: number,
): ColumnDraft & { id: string } {
  const role = normalizeRole(patch.role, column.role as ColumnRole);
  const wipMode = normalizeWipMode(patch.wipMode, column.wipMode as WipMode);
  return {
    id: column.id,
    name: normalizeColumnName(patch.name ?? column.name),
    role,
    position,
    wipMode,
    wipLimit: normalizeWipLimit(
      patch.wipLimit === undefined ? column.wipLimit : patch.wipLimit,
      wipMode,
    ),
    completedGrouping: normalizeCompletedGrouping(
      patch.completedGrouping === undefined ? column.completedGrouping : patch.completedGrouping,
      column.completedGrouping as CompletedGrouping,
    ),
  };
}

async function applyColumnDrafts(
  tx: ProjectTransaction,
  accountId: string,
  project: Project,
  drafts: Array<ColumnDraft & { id: string }>,
  options: ColumnConfigurationOptions,
  now: Date,
): Promise<ProjectSnapshot> {
  const normalized = validateColumnDrafts(drafts).map((draft) => {
    if (!draft.id) throw new AppError("CONCURRENT_UPDATE");
    return { ...draft, id: normalizeUuid(draft.id) };
  });
  const current = await tx
    .select()
    .from(columns)
    .where(eq(columns.projectId, project.id))
    .orderBy(asc(columns.position), asc(columns.createdAt))
    .for("update");
  if (current.length !== normalized.length) throw new AppError("CONCURRENT_UPDATE");
  const currentById = new Map(current.map((column) => [column.id, column]));
  for (const draft of normalized) {
    if (!currentById.has(draft.id)) throw new AppError("CONCURRENT_UPDATE");
  }
  for (const oldColumn of current) {
    const next = normalized.find((column) => column.id === oldColumn.id);
    if (!next) throw new AppError("CONCURRENT_UPDATE");
    if (completionMeaningChanges(oldColumn.role as ColumnRole, next.role)) {
      requireCompletionConfirmation(
        oldColumn.role as ColumnRole,
        next.role,
        options.confirmCompletionChanges,
      );
    }
  }

  // Clear the partial active index first. The deferred invariant trigger makes
  // the temporary neutral state safe until every desired role is applied.
  await tx
    .update(columns)
    .set({ role: "neutral", updatedAt: now })
    .where(eq(columns.projectId, project.id));
  for (const draft of normalized) {
    await tx
      .update(columns)
      .set({
        name: draft.name,
        role: draft.role,
        position: draft.position,
        wipMode: draft.wipMode,
        wipLimit: draft.wipLimit,
        completedGrouping: draft.completedGrouping,
        updatedAt: now,
      })
      .where(and(eq(columns.id, draft.id), eq(columns.projectId, project.id)));
  }
  await tx
    .update(projects)
    .set({ revision: sql`${projects.revision} + 1`, updatedAt: now })
    .where(eq(projects.id, project.id));
  return getProjectSnapshot(tx, accountId, project.id);
}

export async function configureColumns(
  db: Database,
  accountId: string,
  projectId: string,
  rawDrafts: Array<ColumnDraft & { id: string }>,
  options: ColumnConfigurationOptions = {},
  now = new Date(),
): Promise<ProjectSnapshot> {
  return db.transaction(async (tx) => {
    const project = await lockProjectRow(tx, accountId, projectId);
    assertRevision(options.expectedRevision, project.revision);
    return applyColumnDrafts(tx, accountId, project, rawDrafts, options, now);
  });
}

export async function addColumn(
  db: Database,
  accountId: string,
  projectId: string,
  patch: ColumnPatch,
  options: ColumnConfigurationOptions = {},
  now = new Date(),
): Promise<ProjectSnapshot> {
  return db.transaction(async (tx) => {
    const project = await lockProjectRow(tx, accountId, projectId);
    assertRevision(options.expectedRevision, project.revision);
    const current = await tx
      .select()
      .from(columns)
      .where(eq(columns.projectId, projectId))
      .orderBy(asc(columns.position), asc(columns.createdAt))
      .for("update");
    if (current.length >= 100) throw new AppError("INVALID_REQUEST");
    const newRole = normalizeRole(patch.role);
    const newWipMode = normalizeWipMode(patch.wipMode);
    const newColumn = {
      name: normalizeColumnName(patch.name ?? "New column"),
      role: newRole,
      position: current.length,
      wipMode: newWipMode,
      wipLimit: normalizeWipLimit(patch.wipLimit, newWipMode),
      completedGrouping: normalizeCompletedGrouping(patch.completedGrouping),
    };
    assertUniqueNames([...current.map((column) => column.name), newColumn.name]);
    const [inserted] = await tx
      .insert(columns)
      .values({
        projectId,
        ...newColumn,
        role: "neutral",
        createdAt: now,
        updatedAt: now,
      })
      .returning();
    if (!inserted) throw new Error("Column could not be created.");
    const target = current.map((column, index) => ({
      id: column.id,
      name: column.name,
      role: (newRole === "active" && column.role === "active"
        ? "neutral"
        : column.role) as ColumnRole,
      position: index,
      wipMode: column.wipMode as WipMode,
      wipLimit: column.wipLimit,
      completedGrouping: column.completedGrouping as CompletedGrouping,
    }));
    target.push({ ...newColumn, id: inserted.id, position: current.length });
    return applyColumnDrafts(tx, accountId, project, target, options, now);
  });
}

export async function updateColumn(
  db: Database,
  accountId: string,
  projectId: string,
  columnId: string,
  patch: ColumnPatch,
  options: ColumnConfigurationOptions = {},
  now = new Date(),
): Promise<ProjectSnapshot> {
  return db.transaction(async (tx) => {
    const project = await lockProjectRow(tx, accountId, projectId);
    assertRevision(options.expectedRevision, project.revision);
    const current = await tx
      .select()
      .from(columns)
      .where(eq(columns.projectId, projectId))
      .orderBy(asc(columns.position), asc(columns.createdAt))
      .for("update");
    const normalizedColumnId = normalizeUuid(columnId);
    const targetColumn = current.find((column) => column.id === normalizedColumnId);
    if (!targetColumn) throw new AppError("NOT_FOUND");
    const requestedRole = patch.role === undefined ? undefined : normalizeRole(patch.role);
    const target = current.map((column, index) => {
      const next =
        column.id === normalizedColumnId
          ? draftFromColumn(column, patch, index)
          : draftFromColumn(column, {}, index);
      if (
        requestedRole === "active" &&
        column.id !== normalizedColumnId &&
        column.role === "active"
      ) {
        next.role = "neutral";
      }
      return next;
    });
    assertUniqueNames(target.map((column) => column.name));
    return applyColumnDrafts(tx, accountId, project, target, options, now);
  });
}

export async function reorderColumns(
  db: Database,
  accountId: string,
  projectId: string,
  orderedColumnIds: unknown,
  options: ColumnConfigurationOptions = {},
  now = new Date(),
): Promise<ProjectSnapshot> {
  if (
    !Array.isArray(orderedColumnIds) ||
    orderedColumnIds.length < 2 ||
    orderedColumnIds.some((id) => typeof id !== "string")
  ) {
    throw new AppError("INVALID_REQUEST");
  }
  const normalizedColumnIds = orderedColumnIds.map((id) => normalizeUuid(id));
  return db.transaction(async (tx) => {
    const project = await lockProjectRow(tx, accountId, projectId);
    assertRevision(options.expectedRevision, project.revision);
    const current = await tx
      .select()
      .from(columns)
      .where(eq(columns.projectId, projectId))
      .orderBy(asc(columns.position), asc(columns.createdAt))
      .for("update");
    if (
      current.length !== normalizedColumnIds.length ||
      new Set(normalizedColumnIds).size !== current.length ||
      current.some((column) => !normalizedColumnIds.includes(column.id))
    ) {
      throw new AppError("CONCURRENT_UPDATE");
    }
    const byId = new Map(current.map((column) => [column.id, column]));
    const target = normalizedColumnIds.map((id, position) =>
      draftFromColumn(byId.get(id)!, {}, position),
    );
    return applyColumnDrafts(tx, accountId, project, target, options, now);
  });
}

export async function deleteColumn(
  db: Database,
  accountId: string,
  projectId: string,
  columnId: string,
  options: ColumnConfigurationOptions = {},
  now = new Date(),
): Promise<ProjectSnapshot> {
  return db.transaction(async (tx) => {
    const project = await lockProjectRow(tx, accountId, projectId);
    assertRevision(options.expectedRevision, project.revision);
    const current = await tx
      .select()
      .from(columns)
      .where(eq(columns.projectId, projectId))
      .orderBy(asc(columns.position), asc(columns.createdAt))
      .for("update");
    const normalizedColumnId = normalizeUuid(columnId);
    const targetColumn = current.find((column) => column.id === normalizedColumnId);
    if (!targetColumn) throw new AppError("NOT_FOUND");
    const remaining = current.filter((column) => column.id !== normalizedColumnId);
    const target = remaining.map((column, position) => draftFromColumn(column, {}, position));
    validateColumnDrafts(target);
    await tx
      .delete(columns)
      .where(and(eq(columns.id, normalizedColumnId), eq(columns.projectId, projectId)));
    await applyColumnDrafts(tx, accountId, project, target, options, now);
    return getProjectSnapshot(tx, accountId, projectId);
  });
}

export async function createSwimlane(
  db: Database,
  accountId: string,
  projectId: string,
  rawName: unknown,
  options: BoardMutationOptions = {},
  now = new Date(),
): Promise<ProjectSnapshot> {
  const name = normalizeSwimlaneName(rawName);
  return db.transaction(async (tx) => {
    const project = await lockProjectRow(tx, accountId, projectId);
    assertRevision(options.expectedRevision, project.revision);
    const [last] = await tx
      .select({ position: swimlanes.position })
      .from(swimlanes)
      .where(eq(swimlanes.projectId, projectId))
      .orderBy(desc(swimlanes.position))
      .limit(1);
    const existing = await tx
      .select({ name: swimlanes.name })
      .from(swimlanes)
      .where(eq(swimlanes.projectId, projectId));
    assertUniqueNames([...existing.map((row) => row.name), name]);
    await tx.insert(swimlanes).values({
      projectId,
      name,
      position: (last?.position ?? -1) + 1,
      createdAt: now,
      updatedAt: now,
    });
    await tx
      .update(projects)
      .set({ revision: sql`${projects.revision} + 1`, updatedAt: now })
      .where(eq(projects.id, project.id));
    return getProjectSnapshot(tx, accountId, projectId);
  });
}

export async function updateSwimlane(
  db: Database,
  accountId: string,
  projectId: string,
  swimlaneId: string,
  patch: SwimlanePatch,
  options: BoardMutationOptions = {},
  now = new Date(),
): Promise<ProjectSnapshot> {
  return db.transaction(async (tx) => {
    const project = await lockProjectRow(tx, accountId, projectId);
    assertRevision(options.expectedRevision, project.revision);
    const normalizedSwimlaneId = normalizeUuid(swimlaneId);
    const current = await tx
      .select()
      .from(swimlanes)
      .where(eq(swimlanes.projectId, projectId))
      .orderBy(asc(swimlanes.position), asc(swimlanes.createdAt))
      .for("update");
    const row = current.find((lane) => lane.id === normalizedSwimlaneId);
    if (!row) throw new AppError("NOT_FOUND");
    const name = patch.name === undefined ? row.name : normalizeSwimlaneName(patch.name);
    const position = normalizePosition(patch.position, row.position);
    assertUniqueNames(current.map((lane) => (lane.id === row.id ? name : lane.name)));
    await tx
      .update(swimlanes)
      .set({ name, position, updatedAt: now })
      .where(and(eq(swimlanes.id, normalizedSwimlaneId), eq(swimlanes.projectId, projectId)));
    await tx
      .update(projects)
      .set({ revision: sql`${projects.revision} + 1`, updatedAt: now })
      .where(eq(projects.id, project.id));
    return getProjectSnapshot(tx, accountId, projectId);
  });
}

export async function reorderSwimlanes(
  db: Database,
  accountId: string,
  projectId: string,
  orderedIds: unknown,
  options: BoardMutationOptions = {},
  now = new Date(),
): Promise<ProjectSnapshot> {
  if (!Array.isArray(orderedIds) || orderedIds.some((id) => typeof id !== "string")) {
    throw new AppError("INVALID_REQUEST");
  }
  const normalizedIds = orderedIds.map((id) => normalizeUuid(id));
  return db.transaction(async (tx) => {
    const project = await lockProjectRow(tx, accountId, projectId);
    assertRevision(options.expectedRevision, project.revision);
    const current = await tx
      .select()
      .from(swimlanes)
      .where(eq(swimlanes.projectId, projectId))
      .orderBy(asc(swimlanes.position), asc(swimlanes.createdAt))
      .for("update");
    if (
      current.length !== normalizedIds.length ||
      new Set(normalizedIds).size !== current.length ||
      current.some((lane) => !normalizedIds.includes(lane.id))
    )
      throw new AppError("CONCURRENT_UPDATE");
    for (const [position, id] of normalizedIds.entries()) {
      await tx
        .update(swimlanes)
        .set({ position, updatedAt: now })
        .where(and(eq(swimlanes.id, id), eq(swimlanes.projectId, projectId)));
    }
    await tx
      .update(projects)
      .set({ revision: sql`${projects.revision} + 1`, updatedAt: now })
      .where(eq(projects.id, project.id));
    return getProjectSnapshot(tx, accountId, projectId);
  });
}

export async function deleteSwimlane(
  db: Database,
  accountId: string,
  projectId: string,
  swimlaneId: string,
  options: BoardMutationOptions = {},
  now = new Date(),
): Promise<ProjectSnapshot> {
  return db.transaction(async (tx) => {
    const project = await lockProjectRow(tx, accountId, projectId);
    assertRevision(options.expectedRevision, project.revision);
    const normalizedSwimlaneId = normalizeUuid(swimlaneId);
    const [lane] = await tx
      .select()
      .from(swimlanes)
      .where(and(eq(swimlanes.id, normalizedSwimlaneId), eq(swimlanes.projectId, projectId)))
      .for("update");
    if (!lane) throw new AppError("NOT_FOUND");
    // Tasks are introduced in Phase 3. Until then every lane is empty by the
    // workflow boundary, so deletion cannot silently discard task state.
    await tx
      .delete(swimlanes)
      .where(and(eq(swimlanes.id, normalizedSwimlaneId), eq(swimlanes.projectId, projectId)));
    await tx
      .update(projects)
      .set({ revision: sql`${projects.revision} + 1`, updatedAt: now })
      .where(eq(projects.id, project.id));
    return getProjectSnapshot(tx, accountId, projectId);
  });
}

export async function createLabel(
  db: Database,
  accountId: string,
  projectId: string,
  input: { name: unknown; color?: unknown },
  options: BoardMutationOptions = {},
  now = new Date(),
): Promise<ProjectSnapshot> {
  const name = normalizeLabelName(input.name);
  const color = normalizeColor(input.color);
  return db.transaction(async (tx) => {
    const project = await lockProjectRow(tx, accountId, projectId);
    assertRevision(options.expectedRevision, project.revision);
    const [last] = await tx
      .select({ position: labels.position })
      .from(labels)
      .where(eq(labels.projectId, projectId))
      .orderBy(desc(labels.position))
      .limit(1);
    try {
      await tx.insert(labels).values({
        projectId,
        name,
        normalizedName: normalizedLabelName(name),
        color,
        position: (last?.position ?? -1) + 1,
        createdAt: now,
        updatedAt: now,
      });
    } catch (error) {
      if (isUniqueConstraintViolation(error)) throw new AppError("CONFLICT");
      throw error;
    }
    await tx
      .update(projects)
      .set({ revision: sql`${projects.revision} + 1`, updatedAt: now })
      .where(eq(projects.id, project.id));
    return getProjectSnapshot(tx, accountId, projectId);
  });
}

export async function updateLabel(
  db: Database,
  accountId: string,
  projectId: string,
  labelId: string,
  patch: LabelPatch,
  options: BoardMutationOptions = {},
  now = new Date(),
): Promise<ProjectSnapshot> {
  return db.transaction(async (tx) => {
    const project = await lockProjectRow(tx, accountId, projectId);
    assertRevision(options.expectedRevision, project.revision);
    const normalizedLabelId = normalizeUuid(labelId);
    const [label] = await tx
      .select()
      .from(labels)
      .where(and(eq(labels.id, normalizedLabelId), eq(labels.projectId, projectId)))
      .for("update");
    if (!label) throw new AppError("NOT_FOUND");
    const name = patch.name === undefined ? label.name : normalizeLabelName(patch.name);
    const color = patch.color === undefined ? label.color : normalizeColor(patch.color);
    const position = normalizePosition(patch.position, label.position);
    try {
      await tx
        .update(labels)
        .set({ name, normalizedName: normalizedLabelName(name), color, position, updatedAt: now })
        .where(and(eq(labels.id, normalizedLabelId), eq(labels.projectId, projectId)));
    } catch (error) {
      if (isUniqueConstraintViolation(error)) throw new AppError("CONFLICT");
      throw error;
    }
    await tx
      .update(projects)
      .set({ revision: sql`${projects.revision} + 1`, updatedAt: now })
      .where(eq(projects.id, project.id));
    return getProjectSnapshot(tx, accountId, projectId);
  });
}

export async function reorderLabels(
  db: Database,
  accountId: string,
  projectId: string,
  orderedIds: unknown,
  options: BoardMutationOptions = {},
  now = new Date(),
): Promise<ProjectSnapshot> {
  if (!Array.isArray(orderedIds) || orderedIds.some((id) => typeof id !== "string"))
    throw new AppError("INVALID_REQUEST");
  const normalizedIds = orderedIds.map((id) => normalizeUuid(id));
  return db.transaction(async (tx) => {
    const project = await lockProjectRow(tx, accountId, projectId);
    assertRevision(options.expectedRevision, project.revision);
    const current = await tx
      .select()
      .from(labels)
      .where(eq(labels.projectId, projectId))
      .orderBy(asc(labels.position), asc(labels.createdAt))
      .for("update");
    if (
      current.length !== normalizedIds.length ||
      new Set(normalizedIds).size !== current.length ||
      current.some((label) => !normalizedIds.includes(label.id))
    )
      throw new AppError("CONCURRENT_UPDATE");
    for (const [position, id] of normalizedIds.entries()) {
      await tx
        .update(labels)
        .set({ position, updatedAt: now })
        .where(and(eq(labels.id, id), eq(labels.projectId, projectId)));
    }
    await tx
      .update(projects)
      .set({ revision: sql`${projects.revision} + 1`, updatedAt: now })
      .where(eq(projects.id, project.id));
    return getProjectSnapshot(tx, accountId, projectId);
  });
}

export async function deleteLabel(
  db: Database,
  accountId: string,
  projectId: string,
  labelId: string,
  options: BoardMutationOptions = {},
  now = new Date(),
): Promise<ProjectSnapshot> {
  return db.transaction(async (tx) => {
    const project = await lockProjectRow(tx, accountId, projectId);
    assertRevision(options.expectedRevision, project.revision);
    const normalizedLabelId = normalizeUuid(labelId);
    const deleted = await tx
      .delete(labels)
      .where(and(eq(labels.id, normalizedLabelId), eq(labels.projectId, projectId)))
      .returning({ id: labels.id });
    if (deleted.length === 0) throw new AppError("NOT_FOUND");
    await tx
      .update(projects)
      .set({ revision: sql`${projects.revision} + 1`, updatedAt: now })
      .where(eq(projects.id, project.id));
    return getProjectSnapshot(tx, accountId, projectId);
  });
}

export async function projectListPayload(db: ProjectDatabase, accountId: string) {
  const rows = await listProjects(db, accountId);
  if (rows.length === 0) return [];
  const counts = await db
    .select({ projectId: columns.projectId, columnCount: sql<number>`count(*)::int` })
    .from(columns)
    .where(
      inArray(
        columns.projectId,
        rows.map((project) => project.id),
      ),
    )
    .groupBy(columns.projectId);
  const countByProject = new Map(counts.map((row) => [row.projectId, row.columnCount]));
  return rows.map((project) => ({
    ...project,
    columnCount: countByProject.get(project.id) ?? 0,
    lifecycle: project.status,
    archived: project.status === "archived",
  }));
}

export { projectPayload };
