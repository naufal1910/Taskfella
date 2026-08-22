import {
  and,
  asc,
  desc,
  eq,
  gte,
  ilike,
  inArray,
  isNotNull,
  isNull,
  lt,
  lte,
  ne,
  or,
  sql,
} from "drizzle-orm";
import { type Database } from "@/server/db/client";
import {
  columns,
  labels,
  notes,
  projects,
  subtasks,
  taskLabels,
  taskLifecycleEvents,
  tasks,
  swimlanes,
  type Note,
  type Project,
  type Subtask,
  type Task,
  type TaskLifecycleEvent,
} from "@/server/db/schema";
import { AppError } from "@/server/http/errors";
import { evaluateWip, type WipEvaluation } from "@/server/modules/workflow/wip";
import { normalizeUuid, type ColumnRole, type WipMode } from "@/server/modules/projects/types";
import {
  normalizeBoolean,
  normalizeDueDate,
  normalizeDueDateState,
  normalizeExpectedRevision,
  normalizeLabelIds,
  normalizeOptionalUuid,
  normalizeSearch,
  normalizeTaskColor,
  normalizeTaskDescription,
  normalizeTaskId,
  normalizeTaskPosition,
  normalizeTaskTitle,
  type DueDateState,
  type TaskCreateInput,
  type TaskListInput,
  type TaskMoveInput,
  type TaskPatchInput,
} from "./types";
import { normalizePlainText, sanitizeMarkdown } from "./markdown";

type TaskTransaction = Parameters<Parameters<Database["transaction"]>[0]>[0];
type TaskDatabase = Database | TaskTransaction;

const TEMP_POSITION = 2_000_000_000;
const TEMP_INSERT_POSITION = 2_100_000_000;

export interface TaskSnapshot {
  task: Task;
  labels: Array<typeof labels.$inferSelect>;
  subtasks: Subtask[];
  notes: Note[];
  lifecycle: TaskLifecycleEvent[];
}

export interface TaskListItem extends Task {
  labels: Array<typeof labels.$inferSelect>;
  subtaskCount: number;
  completedSubtaskCount: number;
  noteCount: number;
}

interface TaskLocation {
  columnId: string;
  swimlaneId: string | null;
  role: ColumnRole;
}

interface TaskListOptions {
  search?: string;
  labelId?: string;
  color?: string;
  due?: DueDateState;
  columnId?: string;
  swimlaneId?: string | null;
  trashOnly?: boolean;
  timezone?: string;
}

function nowDate(now?: Date): Date {
  return now ?? new Date();
}

function taskPayload(snapshot: TaskSnapshot) {
  return {
    ...snapshot.task,
    labels: snapshot.labels,
    subtasks: snapshot.subtasks,
    notes: snapshot.notes,
    lifecycle: snapshot.lifecycle,
  };
}

export function serializeTask(snapshot: TaskSnapshot) {
  return taskPayload(snapshot);
}

async function lockProjectRow(
  tx: TaskTransaction,
  accountId: string,
  projectId: string,
): Promise<Project> {
  const normalizedProjectId = normalizeUuid(projectId);
  const [owned] = await tx
    .select({ id: projects.id })
    .from(projects)
    .where(and(eq(projects.id, normalizedProjectId), eq(projects.accountId, accountId)))
    .limit(1);
  if (!owned) throw new AppError("NOT_FOUND");

  await tx.execute(
    sql`SELECT pg_advisory_xact_lock(hashtext(${`taskfella-workflow:${normalizedProjectId}`}))`,
  );
  const [project] = await tx
    .select()
    .from(projects)
    .where(and(eq(projects.id, normalizedProjectId), eq(projects.accountId, accountId)))
    .for("update");
  if (!project) throw new AppError("NOT_FOUND");
  if (project.status !== "active") throw new AppError("PROJECT_ARCHIVED");
  return project;
}

async function ownedTask(
  db: TaskDatabase,
  accountId: string,
  taskId: string,
  lock = false,
): Promise<Task> {
  const normalizedTaskId = normalizeTaskId(taskId);
  const query = db
    .select()
    .from(tasks)
    .where(and(eq(tasks.id, normalizedTaskId), eq(tasks.accountId, accountId)))
    .limit(1);
  const rows = lock ? await query.for("update") : await query;
  const task = rows[0];
  if (!task) throw new AppError("NOT_FOUND");
  return task;
}

async function lockTaskContext(
  tx: TaskTransaction,
  accountId: string,
  taskId: string,
): Promise<{ project: Project; task: Task }> {
  const normalizedTaskId = normalizeTaskId(taskId);
  const [probe] = await tx
    .select({ projectId: tasks.projectId })
    .from(tasks)
    .where(and(eq(tasks.id, normalizedTaskId), eq(tasks.accountId, accountId)))
    .limit(1);
  if (!probe) throw new AppError("NOT_FOUND");
  const project = await lockProjectRow(tx, accountId, probe.projectId);
  const task = await ownedTask(tx, accountId, normalizedTaskId, true);
  return { project, task };
}

async function destinationLocation(
  tx: TaskTransaction,
  projectId: string,
  current: Task,
  rawColumnId: unknown,
  rawSwimlaneId: unknown,
): Promise<TaskLocation> {
  const columnId = normalizeUuid(rawColumnId);
  const [column] = await tx
    .select()
    .from(columns)
    .where(and(eq(columns.id, columnId), eq(columns.projectId, projectId)))
    .limit(1);
  if (!column) throw new AppError("NOT_FOUND");

  const swimlaneId =
    rawSwimlaneId === undefined
      ? current.swimlaneId
      : (normalizeOptionalUuid(rawSwimlaneId) ?? null);
  if (swimlaneId !== null) {
    const [lane] = await tx
      .select({ id: swimlanes.id })
      .from(swimlanes)
      .where(and(eq(swimlanes.id, swimlaneId), eq(swimlanes.projectId, projectId)))
      .limit(1);
    if (!lane) throw new AppError("NOT_FOUND");
  }
  return { columnId, swimlaneId, role: column.role as ColumnRole };
}

function laneCondition(laneId: string | null) {
  return laneId === null ? isNull(tasks.swimlaneId) : eq(tasks.swimlaneId, laneId);
}

async function countColumnTasks(
  tx: TaskTransaction,
  projectId: string,
  columnId: string,
  excludeTaskId?: string,
): Promise<number> {
  const conditions = [
    eq(tasks.projectId, projectId),
    eq(tasks.columnId, columnId),
    isNull(tasks.deletedAt),
  ];
  if (excludeTaskId) conditions.push(ne(tasks.id, excludeTaskId));
  const [row] = await tx
    .select({ count: sql<number>`count(*)::int` })
    .from(tasks)
    .where(and(...conditions));
  return Number(row?.count ?? 0);
}

async function assertTaskWip(
  tx: TaskTransaction,
  projectId: string,
  location: TaskLocation,
  task: Task | undefined,
  warningConfirmed: boolean,
): Promise<WipEvaluation> {
  const [column] = await tx
    .select()
    .from(columns)
    .where(and(eq(columns.id, location.columnId), eq(columns.projectId, projectId)))
    .limit(1);
  if (!column) throw new AppError("NOT_FOUND");
  const exclude = task && task.columnId === location.columnId ? task.id : undefined;
  const currentCount = await countColumnTasks(tx, projectId, location.columnId, exclude);
  return evaluateWip(column.wipMode as WipMode, column.wipLimit, currentCount, warningConfirmed);
}

async function orderedTaskGroup(
  tx: TaskTransaction,
  projectId: string,
  columnId: string,
  swimlaneId: string | null,
): Promise<Task[]> {
  return tx
    .select()
    .from(tasks)
    .where(
      and(
        eq(tasks.projectId, projectId),
        eq(tasks.columnId, columnId),
        laneCondition(swimlaneId),
        isNull(tasks.deletedAt),
      ),
    )
    .orderBy(asc(tasks.position), asc(tasks.createdAt), asc(tasks.id))
    .for("update");
}

async function applyTaskOrder(
  tx: TaskTransaction,
  projectId: string,
  taskId: string,
  source: TaskLocation,
  destination: TaskLocation,
  requestedPosition: number | undefined,
  now: Date,
): Promise<number> {
  const sameGroup =
    source.columnId === destination.columnId && source.swimlaneId === destination.swimlaneId;
  const sourceTasks = await orderedTaskGroup(tx, projectId, source.columnId, source.swimlaneId);
  const destinationTasks = sameGroup
    ? sourceTasks
    : await orderedTaskGroup(tx, projectId, destination.columnId, destination.swimlaneId);
  const sourceWithout = sourceTasks.filter((task) => task.id !== taskId);
  const destinationWithout = sameGroup
    ? sourceWithout
    : destinationTasks.filter((task) => task.id !== taskId);
  const targetPosition = Math.min(
    requestedPosition ?? (sameGroup ? sourceTasks.findIndex((task) => task.id === taskId) : -1),
    destinationWithout.length,
  );
  const boundedPosition = Math.max(
    0,
    targetPosition < 0 ? destinationWithout.length : targetPosition,
  );
  const orderedIds = [...destinationWithout];
  orderedIds.splice(boundedPosition, 0, { id: taskId } as Task);

  const affected = new Map<string, Task>();
  for (const task of sourceTasks) affected.set(task.id, task);
  for (const task of destinationTasks) affected.set(task.id, task);
  const affectedRows = [...affected.values()].sort(
    (left, right) =>
      Number(right.position >= TEMP_POSITION) - Number(left.position >= TEMP_POSITION),
  );
  for (const [index, task] of affectedRows.entries()) {
    await tx
      .update(tasks)
      .set({ position: TEMP_POSITION - index, updatedAt: now })
      .where(eq(tasks.id, task.id));
  }

  for (const [position, task] of orderedIds.entries()) {
    if (task.id === taskId) {
      await tx
        .update(tasks)
        .set({
          columnId: destination.columnId,
          swimlaneId: destination.swimlaneId,
          position,
          updatedAt: now,
        })
        .where(eq(tasks.id, taskId));
    } else {
      await tx.update(tasks).set({ position, updatedAt: now }).where(eq(tasks.id, task.id));
    }
  }

  for (const [position, task] of sourceWithout.entries()) {
    if (sameGroup) continue;
    await tx.update(tasks).set({ position, updatedAt: now }).where(eq(tasks.id, task.id));
  }
  return boundedPosition;
}

async function compactTaskGroup(
  tx: TaskTransaction,
  projectId: string,
  columnId: string,
  swimlaneId: string | null,
  now: Date,
): Promise<void> {
  const rows = await orderedTaskGroup(tx, projectId, columnId, swimlaneId);
  for (const [index, task] of rows.entries()) {
    await tx
      .update(tasks)
      .set({ position: TEMP_POSITION - index, updatedAt: now })
      .where(eq(tasks.id, task.id));
  }
  for (const [position, task] of rows.entries()) {
    await tx.update(tasks).set({ position, updatedAt: now }).where(eq(tasks.id, task.id));
  }
}

async function replaceTaskLabels(
  tx: TaskTransaction,
  task: Task,
  labelIds: string[],
  now: Date,
): Promise<void> {
  if (labelIds.length > 0) {
    const ownedLabels = await tx
      .select({ id: labels.id })
      .from(labels)
      .where(and(eq(labels.projectId, task.projectId), inArray(labels.id, labelIds)));
    if (ownedLabels.length !== labelIds.length) throw new AppError("NOT_FOUND");
  }
  await tx.delete(taskLabels).where(eq(taskLabels.taskId, task.id));
  if (labelIds.length > 0) {
    await tx.insert(taskLabels).values(
      labelIds.map((labelId) => ({
        taskId: task.id,
        labelId,
        projectId: task.projectId,
        accountId: task.accountId,
        createdAt: now,
      })),
    );
  }
}

async function taskLabelsFor(db: TaskDatabase, taskId: string) {
  const rows = await db
    .select({ label: labels })
    .from(taskLabels)
    .innerJoin(labels, eq(taskLabels.labelId, labels.id))
    .where(eq(taskLabels.taskId, taskId))
    .orderBy(asc(labels.position), asc(labels.createdAt), asc(labels.id));
  return rows.map((row) => row.label);
}

async function getTaskSnapshotByRow(db: TaskDatabase, task: Task): Promise<TaskSnapshot> {
  const [taskSubtasks, taskNotes, lifecycle, taskLabelsRows] = await Promise.all([
    db
      .select()
      .from(subtasks)
      .where(eq(subtasks.taskId, task.id))
      .orderBy(asc(subtasks.position), asc(subtasks.createdAt), asc(subtasks.id)),
    db
      .select()
      .from(notes)
      .where(eq(notes.taskId, task.id))
      .orderBy(asc(notes.createdAt), asc(notes.id)),
    db
      .select()
      .from(taskLifecycleEvents)
      .where(eq(taskLifecycleEvents.taskId, task.id))
      .orderBy(asc(taskLifecycleEvents.createdAt), asc(taskLifecycleEvents.id)),
    taskLabelsFor(db, task.id),
  ]);
  return {
    task,
    labels: taskLabelsRows,
    subtasks: taskSubtasks,
    notes: taskNotes,
    lifecycle,
  };
}

async function recordLifecycle(
  tx: TaskTransaction,
  task: Task,
  event: "created" | "moved" | "completed" | "reopened" | "trashed" | "restored",
  now: Date,
  location?: { from?: TaskLocation; to?: TaskLocation },
): Promise<void> {
  await tx.insert(taskLifecycleEvents).values({
    taskId: task.id,
    projectId: task.projectId,
    accountId: task.accountId,
    event,
    fromColumnId: location?.from?.columnId,
    toColumnId: location?.to?.columnId,
    fromSwimlaneId: location?.from?.swimlaneId ?? undefined,
    toSwimlaneId: location?.to?.swimlaneId ?? undefined,
    createdAt: now,
  });
}

async function touchProject(tx: TaskTransaction, project: Project, now: Date): Promise<void> {
  await tx
    .update(projects)
    .set({ revision: sql`${projects.revision} + 1`, updatedAt: now })
    .where(eq(projects.id, project.id));
}

function taskLocation(task: Task, role: ColumnRole): TaskLocation {
  return { columnId: task.columnId, swimlaneId: task.swimlaneId, role };
}

async function currentTaskLocation(tx: TaskTransaction, task: Task): Promise<TaskLocation> {
  const [column] = await tx
    .select({ role: columns.role })
    .from(columns)
    .where(and(eq(columns.id, task.columnId), eq(columns.projectId, task.projectId)))
    .limit(1);
  if (!column) throw new AppError("NOT_FOUND");
  return taskLocation(task, column.role as ColumnRole);
}

export async function getTask(
  db: TaskDatabase,
  accountId: string,
  taskId: string,
): Promise<TaskSnapshot> {
  const task = await ownedTask(db, accountId, taskId);
  return getTaskSnapshotByRow(db, task);
}

export async function assertTaskInProject(
  db: TaskDatabase,
  accountId: string,
  projectId: string,
  taskId: string,
): Promise<Task> {
  const normalizedProjectId = normalizeUuid(projectId);
  const task = await ownedTask(db, accountId, taskId);
  if (task.projectId !== normalizedProjectId) throw new AppError("NOT_FOUND");
  return task;
}

export async function createTask(
  db: Database,
  accountId: string,
  projectId: string,
  rawInput: TaskCreateInput,
  now = new Date(),
): Promise<TaskSnapshot> {
  const title = normalizeTaskTitle(rawInput.title);
  const description = normalizeTaskDescription(rawInput.description);
  const color = normalizeTaskColor(rawInput.color);
  const dueDate = normalizeDueDate(rawInput.dueDate);
  const labelIds = normalizeLabelIds(rawInput.labelIds) ?? [];
  const position = normalizeTaskPosition(rawInput.position);
  const warningConfirmed = normalizeBoolean(rawInput.warningConfirmed);

  return db.transaction(async (tx) => {
    const project = await lockProjectRow(tx, accountId, projectId);
    let columnId = rawInput.columnId;
    if (columnId === undefined) {
      const [active] = await tx
        .select({ id: columns.id })
        .from(columns)
        .where(and(eq(columns.projectId, project.id), eq(columns.role, "active")))
        .limit(1);
      if (!active) throw new AppError("BOARD_INVARIANT_VIOLATION");
      columnId = active.id;
    }
    const location = await destinationLocation(
      tx,
      project.id,
      {
        columnId: "00000000-0000-0000-0000-000000000000",
        projectId: project.id,
        swimlaneId: null,
      } as Task,
      columnId,
      rawInput.swimlaneId,
    );
    await assertTaskWip(tx, project.id, location, undefined, warningConfirmed);

    const [inserted] = await tx
      .insert(tasks)
      .values({
        accountId,
        projectId: project.id,
        columnId: location.columnId,
        swimlaneId: location.swimlaneId,
        title,
        description,
        color,
        dueDate,
        position: TEMP_INSERT_POSITION,
        revision: 0,
        completedAt: location.role === "completed" ? now : null,
        createdAt: now,
        updatedAt: now,
      })
      .returning();
    if (!inserted) throw new Error("Task could not be created.");

    await applyTaskOrder(tx, project.id, inserted.id, location, location, position, now);
    await replaceTaskLabels(tx, inserted, labelIds, now);
    await recordLifecycle(tx, inserted, "created", now, { to: location });
    if (location.role === "completed") await recordLifecycle(tx, inserted, "completed", now);
    await touchProject(tx, project, now);
    const [created] = await tx.select().from(tasks).where(eq(tasks.id, inserted.id));
    if (!created) throw new Error("Created task could not be read.");
    return getTaskSnapshotByRow(tx, created);
  });
}

export async function updateTask(
  db: Database,
  accountId: string,
  taskId: string,
  rawPatch: TaskPatchInput,
  now = new Date(),
): Promise<TaskSnapshot> {
  const title = rawPatch.title === undefined ? undefined : normalizeTaskTitle(rawPatch.title);
  const description =
    rawPatch.description === undefined ? undefined : normalizeTaskDescription(rawPatch.description);
  const color = rawPatch.color === undefined ? undefined : normalizeTaskColor(rawPatch.color);
  const dueDate = rawPatch.dueDate === undefined ? undefined : normalizeDueDate(rawPatch.dueDate);
  const labelIds = normalizeLabelIds(rawPatch.labelIds);
  const position = normalizeTaskPosition(rawPatch.position);
  const expectedRevision = normalizeExpectedRevision(rawPatch.expectedRevision);
  const warningConfirmed = normalizeBoolean(rawPatch.warningConfirmed);
  const hasLocationPatch =
    rawPatch.columnId !== undefined || rawPatch.swimlaneId !== undefined || position !== undefined;

  return db.transaction(async (tx) => {
    const { project, task } = await lockTaskContext(tx, accountId, taskId);
    if (task.deletedAt) throw new AppError("TASK_TRASHED");
    if (expectedRevision !== undefined && expectedRevision !== task.revision) {
      throw new AppError("CONCURRENT_UPDATE");
    }
    const current = await currentTaskLocation(tx, task);
    const destination = hasLocationPatch
      ? await destinationLocation(
          tx,
          project.id,
          task,
          rawPatch.columnId === undefined ? task.columnId : rawPatch.columnId,
          rawPatch.swimlaneId,
        )
      : current;
    const locationChanged =
      current.columnId !== destination.columnId || current.swimlaneId !== destination.swimlaneId;
    const fieldsChanged =
      title !== undefined ||
      description !== undefined ||
      color !== undefined ||
      dueDate !== undefined ||
      labelIds !== undefined;
    if (!locationChanged && !fieldsChanged && position === undefined) {
      return getTaskSnapshotByRow(tx, task);
    }

    if (locationChanged && current.columnId !== destination.columnId) {
      await assertTaskWip(tx, project.id, destination, task, warningConfirmed);
    }

    const completionChanged =
      current.role !== destination.role &&
      (current.role === "completed") !== (destination.role === "completed");
    const completedAt =
      completionChanged && destination.role === "completed"
        ? now
        : completionChanged
          ? null
          : task.completedAt;

    if (locationChanged || position !== undefined) {
      await applyTaskOrder(tx, project.id, task.id, current, destination, position, now);
    }

    await tx
      .update(tasks)
      .set({
        title: title ?? task.title,
        description: description ?? task.description,
        color: color === undefined ? task.color : color,
        dueDate: dueDate === undefined ? task.dueDate : dueDate,
        completedAt,
        revision: sql`${tasks.revision} + 1`,
        updatedAt: now,
      })
      .where(eq(tasks.id, task.id));

    if (labelIds !== undefined) await replaceTaskLabels(tx, task, labelIds, now);
    if (locationChanged)
      await recordLifecycle(tx, task, "moved", now, { from: current, to: destination });
    if (completionChanged) {
      await recordLifecycle(
        tx,
        task,
        destination.role === "completed" ? "completed" : "reopened",
        now,
        { from: current, to: destination },
      );
    }
    await touchProject(tx, project, now);
    const [updated] = await tx.select().from(tasks).where(eq(tasks.id, task.id));
    if (!updated) throw new Error("Task could not be updated.");
    return getTaskSnapshotByRow(tx, updated);
  });
}

export async function moveTask(
  db: Database,
  accountId: string,
  taskId: string,
  rawInput: TaskMoveInput,
  now = new Date(),
): Promise<TaskSnapshot> {
  return updateTask(
    db,
    accountId,
    taskId,
    {
      columnId: rawInput.columnId,
      swimlaneId: rawInput.swimlaneId,
      position: rawInput.position,
      warningConfirmed: rawInput.warningConfirmed,
    },
    now,
  );
}

export async function trashTask(
  db: Database,
  accountId: string,
  taskId: string,
  now = new Date(),
): Promise<TaskSnapshot> {
  return db.transaction(async (tx) => {
    const { project, task } = await lockTaskContext(tx, accountId, taskId);
    if (task.deletedAt) throw new AppError("TASK_TRASHED");
    const current = await currentTaskLocation(tx, task);
    await tx
      .update(tasks)
      .set({
        deletedAt: now,
        restoreColumnId: task.columnId,
        restoreSwimlaneId: task.swimlaneId,
        restorePosition: task.position,
        revision: sql`${tasks.revision} + 1`,
        updatedAt: now,
      })
      .where(eq(tasks.id, task.id));
    await compactTaskGroup(tx, project.id, task.columnId, task.swimlaneId, now);
    await recordLifecycle(tx, task, "trashed", now, { from: current });
    await touchProject(tx, project, now);
    const [trashed] = await tx.select().from(tasks).where(eq(tasks.id, task.id));
    if (!trashed) throw new Error("Trashed task could not be read.");
    return getTaskSnapshotByRow(tx, trashed);
  });
}

export async function restoreTask(
  db: Database,
  accountId: string,
  taskId: string,
  warningConfirmed = false,
  now = new Date(),
): Promise<TaskSnapshot> {
  return db.transaction(async (tx) => {
    const { project, task } = await lockTaskContext(tx, accountId, taskId);
    if (!task.deletedAt) throw new AppError("TASK_NOT_TRASHED");

    let columnId = task.restoreColumnId;
    let role: ColumnRole | undefined;
    if (columnId) {
      const [originalColumn] = await tx
        .select({ id: columns.id, role: columns.role })
        .from(columns)
        .where(and(eq(columns.id, columnId), eq(columns.projectId, project.id)))
        .limit(1);
      if (originalColumn) role = originalColumn.role as ColumnRole;
      else columnId = null;
    }
    if (!columnId) {
      const [fallback] = await tx
        .select({ id: columns.id, role: columns.role })
        .from(columns)
        .where(and(eq(columns.projectId, project.id), ne(columns.role, "completed")))
        .orderBy(asc(columns.position), asc(columns.createdAt))
        .limit(1);
      if (!fallback) throw new AppError("BOARD_INVARIANT_VIOLATION");
      columnId = fallback.id;
      role = fallback.role as ColumnRole;
    }
    let swimlaneId = task.restoreSwimlaneId;
    if (swimlaneId) {
      const [lane] = await tx
        .select({ id: swimlanes.id })
        .from(swimlanes)
        .where(and(eq(swimlanes.id, swimlaneId), eq(swimlanes.projectId, project.id)))
        .limit(1);
      if (!lane) swimlaneId = null;
    }
    const destination: TaskLocation = {
      columnId,
      swimlaneId,
      role: role ?? "neutral",
    };
    await assertTaskWip(tx, project.id, destination, undefined, warningConfirmed);
    const destinationTasks = await orderedTaskGroup(tx, project.id, columnId, swimlaneId);
    const restorePosition =
      task.restorePosition === null ? undefined : (task.restorePosition ?? undefined);
    const boundedPosition = Math.min(
      restorePosition ?? destinationTasks.length,
      destinationTasks.length,
    );

    await tx
      .update(tasks)
      .set({
        deletedAt: null,
        restoreColumnId: null,
        restoreSwimlaneId: null,
        restorePosition: null,
        position: TEMP_INSERT_POSITION,
        revision: sql`${tasks.revision} + 1`,
        updatedAt: now,
      })
      .where(eq(tasks.id, task.id));
    const source: TaskLocation = {
      columnId: task.columnId,
      swimlaneId: task.swimlaneId,
      role: role ?? "neutral",
    };
    await applyTaskOrder(tx, project.id, task.id, source, destination, boundedPosition, now);

    const wasCompleted = task.completedAt !== null;
    const completionChanged = wasCompleted !== (destination.role === "completed");
    const completedAt = destination.role === "completed" ? (task.completedAt ?? now) : null;
    await tx
      .update(tasks)
      .set({
        completedAt,
        revision: sql`${tasks.revision} + 1`,
        updatedAt: now,
      })
      .where(eq(tasks.id, task.id));
    await recordLifecycle(tx, task, "restored", now, { to: destination });
    if (completionChanged) {
      await recordLifecycle(
        tx,
        task,
        destination.role === "completed" ? "completed" : "reopened",
        now,
        { to: destination },
      );
    }
    await touchProject(tx, project, now);
    const [restored] = await tx.select().from(tasks).where(eq(tasks.id, task.id));
    if (!restored) throw new Error("Restored task could not be read.");
    return getTaskSnapshotByRow(tx, restored);
  });
}

export async function permanentlyDeleteTask(
  db: Database,
  accountId: string,
  taskId: string,
  confirmation: unknown,
): Promise<void> {
  if (typeof confirmation !== "string" || confirmation.length === 0) {
    throw new AppError("PERMANENT_TASK_DELETE_CONFIRMATION_REQUIRED");
  }
  await db.transaction(async (tx) => {
    const { project, task } = await lockTaskContext(tx, accountId, taskId);
    if (!task.deletedAt) throw new AppError("TASK_NOT_TRASHED");
    if (confirmation !== task.title) {
      throw new AppError("PERMANENT_TASK_DELETE_CONFIRMATION_REQUIRED");
    }
    await tx.delete(tasks).where(eq(tasks.id, task.id));
    await touchProject(tx, project, new Date());
  });
}

function escapeLike(value: string): string {
  return value.replaceAll("\\", "\\\\").replaceAll("%", "\\%").replaceAll("_", "\\_");
}

function localDateString(date: Date, timezone: string): string {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(date);
    const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
    return `${get("year")}-${get("month")}-${get("day")}`;
  } catch {
    throw new AppError("INVALID_REQUEST");
  }
}

function previousDate(date: string): string {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() - 1);
  return value.toISOString().slice(0, 10);
}

function nextDate(date: string): string {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + 1);
  return value.toISOString().slice(0, 10);
}

function weekBounds(today: string): { start: string; end: string } {
  const value = new Date(`${today}T00:00:00Z`);
  const day = value.getUTCDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  value.setUTCDate(value.getUTCDate() + mondayOffset);
  const start = value.toISOString().slice(0, 10);
  value.setUTCDate(value.getUTCDate() + 6);
  return { start, end: value.toISOString().slice(0, 10) };
}

function dueCondition(state: DueDateState, today: string) {
  if (state === "overdue") return and(isNotNull(tasks.dueDate), lt(tasks.dueDate, today));
  if (state === "today") return eq(tasks.dueDate, today);
  if (state === "no-date") return isNull(tasks.dueDate);
  if (state === "has-date") return isNotNull(tasks.dueDate);
  const bounds = weekBounds(today);
  return and(gte(tasks.dueDate, bounds.start), lte(tasks.dueDate, bounds.end));
}

export async function listTasks(
  db: TaskDatabase,
  accountId: string,
  projectId: string,
  rawOptions: TaskListInput | TaskListOptions = {},
): Promise<TaskListItem[]> {
  const normalizedProjectId = normalizeUuid(projectId);
  const search =
    "search" in rawOptions
      ? normalizeSearch(rawOptions.search)
      : (rawOptions as TaskListOptions).search;
  const labelId =
    "labelId" in rawOptions && rawOptions.labelId !== undefined
      ? normalizeUuid(rawOptions.labelId)
      : (rawOptions as TaskListOptions).labelId;
  const color =
    "color" in rawOptions && rawOptions.color !== undefined
      ? normalizeTaskColor(rawOptions.color)
      : (rawOptions as TaskListOptions).color;
  const due =
    "due" in rawOptions
      ? normalizeDueDateState(rawOptions.due)
      : (rawOptions as TaskListOptions).due;
  const columnId =
    "columnId" in rawOptions && rawOptions.columnId !== undefined
      ? normalizeUuid(rawOptions.columnId)
      : (rawOptions as TaskListOptions).columnId;
  const swimlaneId =
    "swimlaneId" in rawOptions && rawOptions.swimlaneId !== undefined
      ? normalizeOptionalUuid(rawOptions.swimlaneId)
      : (rawOptions as TaskListOptions).swimlaneId;
  const includeTrash =
    "includeTrash" in rawOptions
      ? normalizeBoolean(rawOptions.includeTrash)
      : (rawOptions as TaskListOptions).trashOnly === true;
  const timezone =
    "timezone" in rawOptions && rawOptions.timezone
      ? rawOptions.timezone
      : ((rawOptions as TaskListOptions).timezone ?? "UTC");

  const [project] = await db
    .select({ id: projects.id })
    .from(projects)
    .where(and(eq(projects.id, normalizedProjectId), eq(projects.accountId, accountId)))
    .limit(1);
  if (!project) throw new AppError("NOT_FOUND");

  const conditions = [
    eq(tasks.projectId, normalizedProjectId),
    eq(tasks.accountId, accountId),
    includeTrash ? isNotNull(tasks.deletedAt) : isNull(tasks.deletedAt),
  ];
  if (search) {
    const pattern = `%${escapeLike(search)}%`;
    conditions.push(
      or(
        ilike(tasks.title, pattern),
        ilike(tasks.description, pattern),
        sql<boolean>`EXISTS (SELECT 1 FROM ${subtasks} AS search_subtasks WHERE search_subtasks.task_id = ${tasks.id} AND search_subtasks.text ILIKE ${pattern})`,
        sql<boolean>`EXISTS (SELECT 1 FROM ${notes} AS search_notes WHERE search_notes.task_id = ${tasks.id} AND search_notes.body ILIKE ${pattern})`,
      )!,
    );
  }
  if (labelId) {
    conditions.push(
      sql<boolean>`EXISTS (SELECT 1 FROM ${taskLabels} AS search_labels WHERE search_labels.task_id = ${tasks.id} AND search_labels.label_id = ${labelId} AND search_labels.project_id = ${normalizedProjectId} AND search_labels.account_id = ${accountId})`,
    );
  }
  if (color !== undefined && color !== null) conditions.push(eq(tasks.color, color));
  if (columnId) conditions.push(eq(tasks.columnId, columnId));
  if (swimlaneId !== undefined) conditions.push(laneCondition(swimlaneId));
  if (due) conditions.push(dueCondition(due, localDateString(new Date(), timezone))!);

  const rows = await db
    .select()
    .from(tasks)
    .where(and(...conditions))
    .orderBy(asc(tasks.columnId), asc(tasks.swimlaneId), asc(tasks.position), asc(tasks.createdAt));
  if (rows.length === 0) return [];

  const ids = rows.map((task) => task.id);
  const [labelRows, subtaskRows, noteRows] = await Promise.all([
    db
      .select({ taskId: taskLabels.taskId, label: labels })
      .from(taskLabels)
      .innerJoin(labels, eq(taskLabels.labelId, labels.id))
      .where(inArray(taskLabels.taskId, ids)),
    db
      .select({
        taskId: subtasks.taskId,
        total: sql<number>`count(*)::int`,
        completed: sql<number>`count(*) FILTER (WHERE ${subtasks.completed})::int`,
      })
      .from(subtasks)
      .where(inArray(subtasks.taskId, ids))
      .groupBy(subtasks.taskId),
    db
      .select({ taskId: notes.taskId, count: sql<number>`count(*)::int` })
      .from(notes)
      .where(inArray(notes.taskId, ids))
      .groupBy(notes.taskId),
  ]);
  const labelsByTask = new Map<string, Array<typeof labels.$inferSelect>>();
  for (const row of labelRows)
    labelsByTask.set(row.taskId, [...(labelsByTask.get(row.taskId) ?? []), row.label]);
  const subtasksByTask = new Map(subtaskRows.map((row) => [row.taskId, row]));
  const notesByTask = new Map(noteRows.map((row) => [row.taskId, Number(row.count)]));
  return rows.map((task) => {
    const stats = subtasksByTask.get(task.id);
    return {
      ...task,
      labels: labelsByTask.get(task.id) ?? [],
      subtaskCount: Number(stats?.total ?? 0),
      completedSubtaskCount: Number(stats?.completed ?? 0),
      noteCount: notesByTask.get(task.id) ?? 0,
    };
  });
}

async function lockChildTask(
  tx: TaskTransaction,
  accountId: string,
  taskId: string,
): Promise<{ project: Project; task: Task }> {
  const context = await lockTaskContext(tx, accountId, taskId);
  if (context.task.deletedAt) throw new AppError("TASK_TRASHED");
  return context;
}

async function orderedSubtasks(tx: TaskTransaction, taskId: string): Promise<Subtask[]> {
  return tx
    .select()
    .from(subtasks)
    .where(eq(subtasks.taskId, taskId))
    .orderBy(asc(subtasks.position), asc(subtasks.createdAt), asc(subtasks.id))
    .for("update");
}

async function applySubtaskOrder(
  tx: TaskTransaction,
  taskId: string,
  subtaskId: string,
  requestedPosition: number | undefined,
  now: Date,
): Promise<void> {
  const rows = await orderedSubtasks(tx, taskId);
  const without = rows.filter((row) => row.id !== subtaskId);
  const current = rows.findIndex((row) => row.id === subtaskId);
  const raw = requestedPosition ?? (current < 0 ? without.length : current);
  const position = Math.max(0, Math.min(raw, without.length));
  const ordered = [...without];
  ordered.splice(position, 0, { id: subtaskId } as Subtask);
  const temporaryRows = [...rows].sort(
    (left, right) =>
      Number(right.position >= TEMP_POSITION) - Number(left.position >= TEMP_POSITION),
  );
  for (const [index, row] of temporaryRows.entries()) {
    await tx
      .update(subtasks)
      .set({ position: TEMP_POSITION - index, updatedAt: now })
      .where(eq(subtasks.id, row.id));
  }
  for (const [index, row] of ordered.entries()) {
    await tx
      .update(subtasks)
      .set({ position: index, updatedAt: now })
      .where(eq(subtasks.id, row.id));
  }
}

async function touchTask(tx: TaskTransaction, taskId: string, now: Date): Promise<void> {
  await tx
    .update(tasks)
    .set({ revision: sql`${tasks.revision} + 1`, updatedAt: now })
    .where(eq(tasks.id, taskId));
}

export async function createSubtask(
  db: Database,
  accountId: string,
  taskId: string,
  rawText: unknown,
  rawPosition?: unknown,
  now = new Date(),
): Promise<TaskSnapshot> {
  const text = normalizePlainText(rawText, 500);
  const position = normalizeTaskPosition(rawPosition);
  return db.transaction(async (tx) => {
    const { project, task } = await lockChildTask(tx, accountId, taskId);
    const rows = await orderedSubtasks(tx, task.id);
    const [created] = await tx
      .insert(subtasks)
      .values({
        taskId: task.id,
        projectId: project.id,
        accountId,
        text,
        completed: false,
        position: TEMP_INSERT_POSITION,
        createdAt: now,
        updatedAt: now,
      })
      .returning();
    if (!created) throw new Error("Subtask could not be created.");
    await applySubtaskOrder(tx, task.id, created.id, position ?? rows.length, now);
    await touchTask(tx, task.id, now);
    await touchProject(tx, project, now);
    return getTaskSnapshotByRow(tx, await ownedTask(tx, accountId, task.id));
  });
}

export async function updateSubtask(
  db: Database,
  accountId: string,
  taskId: string,
  subtaskId: string,
  patch: { text?: unknown; completed?: unknown; position?: unknown },
  now = new Date(),
): Promise<TaskSnapshot> {
  const normalizedSubtaskId = normalizeUuid(subtaskId);
  const text = patch.text === undefined ? undefined : normalizePlainText(patch.text, 500);
  const completed = patch.completed === undefined ? undefined : normalizeBoolean(patch.completed);
  const position = normalizeTaskPosition(patch.position);
  return db.transaction(async (tx) => {
    const { project, task } = await lockChildTask(tx, accountId, taskId);
    const [subtask] = await tx
      .select()
      .from(subtasks)
      .where(
        and(
          eq(subtasks.id, normalizedSubtaskId),
          eq(subtasks.taskId, task.id),
          eq(subtasks.projectId, project.id),
          eq(subtasks.accountId, accountId),
        ),
      )
      .for("update");
    if (!subtask) throw new AppError("NOT_FOUND");
    if (position !== undefined) await applySubtaskOrder(tx, task.id, subtask.id, position, now);
    await tx
      .update(subtasks)
      .set({
        text: text ?? subtask.text,
        completed: completed ?? subtask.completed,
        updatedAt: now,
      })
      .where(eq(subtasks.id, subtask.id));
    await touchTask(tx, task.id, now);
    await touchProject(tx, project, now);
    return getTaskSnapshotByRow(tx, await ownedTask(tx, accountId, task.id));
  });
}

export async function deleteSubtask(
  db: Database,
  accountId: string,
  taskId: string,
  subtaskId: string,
  now = new Date(),
): Promise<TaskSnapshot> {
  const normalizedSubtaskId = normalizeUuid(subtaskId);
  return db.transaction(async (tx) => {
    const { project, task } = await lockChildTask(tx, accountId, taskId);
    const [deleted] = await tx
      .delete(subtasks)
      .where(
        and(
          eq(subtasks.id, normalizedSubtaskId),
          eq(subtasks.taskId, task.id),
          eq(subtasks.projectId, project.id),
          eq(subtasks.accountId, accountId),
        ),
      )
      .returning();
    if (!deleted) throw new AppError("NOT_FOUND");
    const remaining = await orderedSubtasks(tx, task.id);
    for (const [index, row] of remaining.entries()) {
      await tx
        .update(subtasks)
        .set({ position: TEMP_POSITION - index, updatedAt: now })
        .where(eq(subtasks.id, row.id));
    }
    for (const [index, row] of remaining.entries()) {
      await tx
        .update(subtasks)
        .set({ position: index, updatedAt: now })
        .where(eq(subtasks.id, row.id));
    }
    await touchTask(tx, task.id, now);
    await touchProject(tx, project, now);
    return getTaskSnapshotByRow(tx, await ownedTask(tx, accountId, task.id));
  });
}

export async function createNote(
  db: Database,
  accountId: string,
  taskId: string,
  rawBody: unknown,
  now = new Date(),
): Promise<TaskSnapshot> {
  const body = sanitizeMarkdown(rawBody, 20_000).trim();
  if (!body) throw new AppError("INVALID_REQUEST");
  return db.transaction(async (tx) => {
    const { project, task } = await lockChildTask(tx, accountId, taskId);
    await tx.insert(notes).values({
      taskId: task.id,
      projectId: project.id,
      accountId,
      body,
      createdAt: now,
      updatedAt: now,
    });
    await touchTask(tx, task.id, now);
    await touchProject(tx, project, now);
    return getTaskSnapshotByRow(tx, await ownedTask(tx, accountId, task.id));
  });
}

export async function updateNote(
  db: Database,
  accountId: string,
  taskId: string,
  noteId: string,
  rawBody: unknown,
  now = new Date(),
): Promise<TaskSnapshot> {
  const normalizedNoteId = normalizeUuid(noteId);
  const body = sanitizeMarkdown(rawBody, 20_000).trim();
  if (!body) throw new AppError("INVALID_REQUEST");
  return db.transaction(async (tx) => {
    const { project, task } = await lockChildTask(tx, accountId, taskId);
    const [note] = await tx
      .select()
      .from(notes)
      .where(
        and(
          eq(notes.id, normalizedNoteId),
          eq(notes.taskId, task.id),
          eq(notes.projectId, project.id),
          eq(notes.accountId, accountId),
        ),
      )
      .for("update");
    if (!note) throw new AppError("NOT_FOUND");
    await tx.update(notes).set({ body, updatedAt: now }).where(eq(notes.id, note.id));
    await touchTask(tx, task.id, now);
    await touchProject(tx, project, now);
    return getTaskSnapshotByRow(tx, await ownedTask(tx, accountId, task.id));
  });
}

export async function deleteNote(
  db: Database,
  accountId: string,
  taskId: string,
  noteId: string,
  now = new Date(),
): Promise<TaskSnapshot> {
  const normalizedNoteId = normalizeUuid(noteId);
  return db.transaction(async (tx) => {
    const { project, task } = await lockChildTask(tx, accountId, taskId);
    const [deleted] = await tx
      .delete(notes)
      .where(
        and(
          eq(notes.id, normalizedNoteId),
          eq(notes.taskId, task.id),
          eq(notes.projectId, project.id),
          eq(notes.accountId, accountId),
        ),
      )
      .returning({ id: notes.id });
    if (!deleted) throw new AppError("NOT_FOUND");
    await touchTask(tx, task.id, now);
    await touchProject(tx, project, now);
    return getTaskSnapshotByRow(tx, await ownedTask(tx, accountId, task.id));
  });
}

export { taskPayload };
