import { afterAll, describe, expect, it } from "vitest";
import { and, asc, eq } from "drizzle-orm";
import { closeDatabase, getDatabase } from "@/server/db/client";
import { accounts, taskLabels, taskLifecycleEvents, tasks } from "@/server/db/schema";
import { createAccount } from "@/server/modules/auth/accounts";
import {
  createProject,
  createLabel,
  createSwimlane,
  deleteColumn,
  deleteSwimlane,
  updateColumn,
} from "@/server/modules/projects/service";
import {
  createNote,
  createSubtask,
  createTask,
  deleteNote,
  deleteSubtask,
  getTask,
  listTasks,
  moveTask,
  permanentlyDeleteTask,
  restoreTask,
  trashTask,
  updateNote,
  updateSubtask,
  updateTask,
} from "@/server/modules/tasks/service";
import { GET as getTaskRoute } from "@/app/api/projects/[projectId]/tasks/[taskId]/route";
import { GET as listTaskRoute } from "@/app/api/projects/[projectId]/tasks/route";
import { createSession } from "@/server/modules/auth/sessions";

const integration = process.env.DATABASE_URL ? describe : describe.skip;
const db = process.env.DATABASE_URL ? getDatabase() : undefined;
const accountIds: string[] = [];

async function owner(prefix: string) {
  if (!db) throw new Error("Database integration is unavailable.");
  const account = await createAccount(db, {
    email: `${prefix}-${crypto.randomUUID()}@example.test`,
  });
  accountIds.push(account.id);
  return account;
}

function sessionRequest(session: string, path: string): Request {
  return new Request(`http://localhost:3000${path}`, {
    headers: { cookie: `taskfella_session=${session}` },
  });
}

integration("Phase 3 tasks and board execution transactions", () => {
  afterAll(async () => {
    if (!db) return;
    for (const accountId of accountIds) {
      await db.delete(accounts).where(eq(accounts.id, accountId));
    }
    await closeDatabase();
  });

  it("creates owned task data, searches all approved text fields, and preserves Markdown safety", async () => {
    if (!db) return;
    const account = await owner("tasks-core");
    const foreign = await owner("tasks-foreign");
    const board = await createProject(db, account.id, {
      name: "Execution board",
      template: "simple",
    });
    const queue = board.columns.find((column) => column.role === "queued")!;
    const active = board.columns.find((column) => column.role === "active")!;
    const labelSnapshot = await createLabel(db, account.id, board.project.id, {
      name: "Focus",
      color: "#176B51",
    });
    const laneSnapshot = await createSwimlane(db, account.id, board.project.id, "Personal");
    const label = labelSnapshot.labels[0]!;
    const lane = laneSnapshot.swimlanes[0]!;

    const task = await createTask(db, account.id, board.project.id, {
      title: "Write launch note",
      description: "**launch** [safe](https://example.com) [unsafe](javascript:alert(1))",
      columnId: queue.id,
      swimlaneId: lane.id,
      labelIds: [label.id],
      dueDate: "2026-08-22",
      color: "#0F766E",
    });
    expect(task.task.description).not.toMatch(/javascript:|<[^>]+>/i);
    expect(task.labels.map((item) => item.name)).toEqual(["Focus"]);

    const uncolored = await createTask(db, account.id, board.project.id, {
      title: "Uncolored task",
      columnId: queue.id,
    });
    expect(uncolored.task.color).toBeNull();
    const renamedUncolored = await updateTask(db, account.id, uncolored.task.id, {
      title: "Renamed uncolored task",
      expectedRevision: uncolored.task.revision,
    });
    expect(renamedUncolored.task.color).toBeNull();
    const colored = await updateTask(db, account.id, uncolored.task.id, {
      color: "#246BCE",
      expectedRevision: renamedUncolored.task.revision,
    });
    expect(colored.task.color).toBe("#246BCE");
    const cleared = await updateTask(db, account.id, uncolored.task.id, {
      color: null,
      expectedRevision: colored.task.revision,
    });
    expect(cleared.task.color).toBeNull();

    const subtask = await createSubtask(db, account.id, task.task.id, "Ship it");
    expect(subtask.subtasks[0]).toMatchObject({ text: "Ship it", position: 0 });
    const noted = await createNote(
      db,
      account.id,
      task.task.id,
      "<script>alert(1)</script> journal entry",
    );
    expect(noted.notes[0]?.body).toBe("alert(1) journal entry");
    const updatedSubtask = await updateSubtask(
      db,
      account.id,
      task.task.id,
      subtask.subtasks[0]!.id,
      { text: "Ship it today", completed: true },
    );
    expect(updatedSubtask.subtasks[0]).toMatchObject({ text: "Ship it today", completed: true });
    const editedNote = await updateNote(
      db,
      account.id,
      task.task.id,
      noted.notes[0]!.id,
      "edited journal entry",
    );
    expect(editedNote.notes[0]?.body).toBe("edited journal entry");
    expect(
      (
        await listTasks(db, account.id, board.project.id, {
          search: "Ship it today",
          timezone: "UTC",
        })
      ).map((item) => item.id),
    ).toContain(task.task.id);
    await deleteNote(db, account.id, task.task.id, noted.notes[0]!.id);
    await deleteSubtask(db, account.id, task.task.id, subtask.subtasks[0]!.id);
    const recreatedNote = await createNote(db, account.id, task.task.id, "journal entry");
    await deleteSwimlane(db, account.id, board.project.id, lane.id);
    expect((await getTask(db, account.id, task.task.id)).task.swimlaneId).toBeNull();

    expect(
      (
        await listTasks(db, account.id, board.project.id, { search: "journal", timezone: "UTC" })
      ).map((item) => item.id),
    ).toContain(task.task.id);
    expect(recreatedNote.notes).toHaveLength(1);
    expect(
      (
        await listTasks(db, account.id, board.project.id, {
          search: "Write launch",
          timezone: "UTC",
        })
      ).map((item) => item.id),
    ).toContain(task.task.id);
    expect(
      (
        await listTasks(db, account.id, board.project.id, {
          labelId: label.id,
          color: "#0F766E",
          timezone: "UTC",
        })
      ).map((item) => item.id),
    ).toContain(task.task.id);
    expect(
      (await listTasks(db, account.id, board.project.id, { due: "today", timezone: "UTC" })).map(
        (item) => item.id,
      ),
    ).toContain(task.task.id);

    await expect(getTask(db, foreign.id, task.task.id)).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    const foreignBoard = await createProject(db, foreign.id, {
      name: "Other board",
      template: "simple",
    });
    await expect(
      createTask(db, account.id, foreignBoard.project.id, { title: "cross owner" }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(
      db.insert(taskLabels).values({
        taskId: task.task.id,
        labelId: label.id,
        projectId: foreignBoard.project.id,
        accountId: foreign.id,
      }),
    ).rejects.toThrow();
  });

  it("enforces WIP transactionally and serializes concurrent movement", async () => {
    if (!db) return;
    const account = await owner("tasks-wip");
    const board = await createProject(db, account.id, { name: "WIP board", template: "simple" });
    const queue = board.columns.find((column) => column.role === "queued")!;
    const active = board.columns.find((column) => column.role === "active")!;
    const configured = await updateColumn(
      db,
      account.id,
      board.project.id,
      active.id,
      { wipMode: "enforce", wipLimit: 1 },
      { expectedRevision: board.project.revision },
    );
    const first = await createTask(db, account.id, board.project.id, {
      title: "First",
      columnId: queue.id,
    });
    const second = await createTask(db, account.id, board.project.id, {
      title: "Second",
      columnId: queue.id,
    });
    await moveTask(db, account.id, first.task.id, { columnId: active.id });
    await expect(
      moveTask(db, account.id, second.task.id, { columnId: active.id }),
    ).rejects.toMatchObject({ code: "WIP_LIMIT_REACHED" });
    const afterRejectedMove = await getTask(db, account.id, second.task.id);
    expect(afterRejectedMove.task.columnId).toBe(queue.id);

    const concurrencyBoard = await createProject(db, account.id, {
      name: "Concurrent WIP",
      template: "simple",
    });
    const concurrencyQueue = concurrencyBoard.columns.find((column) => column.role === "queued")!;
    const concurrencyActive = concurrencyBoard.columns.find((column) => column.role === "active")!;
    await updateColumn(
      db,
      account.id,
      concurrencyBoard.project.id,
      concurrencyActive.id,
      { wipMode: "enforce", wipLimit: 1 },
      { expectedRevision: concurrencyBoard.project.revision },
    );
    const [a, b] = await Promise.all([
      createTask(db, account.id, concurrencyBoard.project.id, {
        title: "Concurrent A",
        columnId: concurrencyQueue.id,
      }),
      createTask(db, account.id, concurrencyBoard.project.id, {
        title: "Concurrent B",
        columnId: concurrencyQueue.id,
      }),
    ]);
    const results = await Promise.allSettled([
      moveTask(db, account.id, a.task.id, { columnId: concurrencyActive.id }),
      moveTask(db, account.id, b.task.id, { columnId: concurrencyActive.id }),
    ]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((result) => result.status === "rejected")).toHaveLength(1);
    const activeRows = await db
      .select()
      .from(tasks)
      .where(
        and(
          eq(tasks.projectId, concurrencyBoard.project.id),
          eq(tasks.columnId, concurrencyActive.id),
        ),
      );
    expect(activeRows).toHaveLength(1);
  });

  it("persists ordering, semantic completion/reopening, lifecycle history, and Trash fallback", async () => {
    if (!db) return;
    const account = await owner("tasks-lifecycle");
    const roleBoard = await createProject(db, account.id, {
      name: "Role board",
      template: "simple",
    });
    const roleQueue = roleBoard.columns.find((column) => column.role === "queued")!;
    const roleTask = await createTask(db, account.id, roleBoard.project.id, {
      title: "Role transition",
      columnId: roleQueue.id,
    });
    await updateColumn(
      db,
      account.id,
      roleBoard.project.id,
      roleQueue.id,
      { role: "completed" },
      { confirmCompletionChanges: true },
    );
    expect((await getTask(db, account.id, roleTask.task.id)).task.completedAt).not.toBeNull();

    const board = await createProject(db, account.id, {
      name: "Lifecycle board",
      template: "simple",
    });
    const queue = board.columns.find((column) => column.role === "queued")!;
    const active = board.columns.find((column) => column.role === "active")!;
    const done = board.columns.find((column) => column.role === "completed")!;
    const first = await createTask(db, account.id, board.project.id, {
      title: "First",
      columnId: queue.id,
    });
    const second = await createTask(db, account.id, board.project.id, {
      title: "Second",
      columnId: queue.id,
    });
    const reordered = await moveTask(db, account.id, second.task.id, {
      columnId: queue.id,
      position: 0,
    });
    expect(reordered.task.position).toBe(0);
    const ordered = await db
      .select({ id: tasks.id, position: tasks.position })
      .from(tasks)
      .where(eq(tasks.projectId, board.project.id))
      .orderBy(asc(tasks.position));
    expect(ordered.slice(0, 2).map((row) => row.id)).toEqual([second.task.id, first.task.id]);

    const completed = await moveTask(db, account.id, first.task.id, { columnId: done.id });
    expect(completed.task.completedAt).not.toBeNull();
    const reopened = await moveTask(db, account.id, first.task.id, { columnId: active.id });
    expect(reopened.task.completedAt).toBeNull();
    expect(reopened.lifecycle.map((event) => event.event)).toEqual(
      expect.arrayContaining(["completed", "reopened"]),
    );

    const trashed = await trashTask(db, account.id, second.task.id);
    expect(trashed.task.restoreColumnId).toBe(queue.id);
    const deletedColumn = await deleteColumn(db, account.id, board.project.id, queue.id);
    expect(deletedColumn.columns.some((column) => column.id === queue.id)).toBe(false);
    const restored = await restoreTask(db, account.id, second.task.id);
    expect(restored.task.deletedAt).toBeNull();
    expect(restored.task.columnId).toBe(active.id);
    expect(restored.lifecycle.map((event) => event.event)).toEqual(
      expect.arrayContaining(["trashed", "restored"]),
    );

    await trashTask(db, account.id, second.task.id);
    await expect(
      permanentlyDeleteTask(db, account.id, second.task.id, "wrong title"),
    ).rejects.toMatchObject({ code: "PERMANENT_TASK_DELETE_CONFIRMATION_REQUIRED" });
    await permanentlyDeleteTask(db, account.id, second.task.id, "Second");
    expect(await db.select().from(tasks).where(eq(tasks.id, second.task.id))).toHaveLength(0);
    expect(
      await db
        .select()
        .from(taskLifecycleEvents)
        .where(eq(taskLifecycleEvents.taskId, second.task.id)),
    ).toHaveLength(0);
  });

  it("exposes authenticated list/detail routes and rejects malformed or foreign IDs safely", async () => {
    if (!db) return;
    const account = await owner("tasks-routes");
    const board = await createProject(db, account.id, {
      name: "Route task board",
      template: "simple",
    });
    const queue = board.columns.find((column) => column.role === "queued")!;
    const task = await createTask(db, account.id, board.project.id, {
      title: "Route task",
      columnId: queue.id,
    });
    const subtask = await createSubtask(db, account.id, task.task.id, "Route checklist item");
    const note = await createNote(db, account.id, task.task.id, "Route journal note");
    const session = await createSession(db, account.id);
    const listed = await listTaskRoute(
      sessionRequest(session.token, `/api/projects/${board.project.id}/tasks`),
      { params: Promise.resolve({ projectId: board.project.id }) },
    );
    expect(listed.status).toBe(200);
    expect((await listed.json()).tasks).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: task.task.id, title: "Route task" })]),
    );
    const detail = await getTaskRoute(
      sessionRequest(session.token, `/api/projects/${board.project.id}/tasks/${task.task.id}`),
      { params: Promise.resolve({ projectId: board.project.id, taskId: task.task.id }) },
    );
    expect(detail.status).toBe(200);
    expect((await detail.json()).task).toMatchObject({
      subtasks: expect.arrayContaining([
        expect.objectContaining({ id: subtask.subtasks[0]!.id }),
      ]),
      notes: expect.arrayContaining([expect.objectContaining({ id: note.notes[0]!.id })]),
    });
    const malformed = await getTaskRoute(
      sessionRequest(session.token, "/api/projects/not-a-uuid/tasks/not-a-uuid"),
      { params: Promise.resolve({ projectId: "not-a-uuid", taskId: "not-a-uuid" }) },
    );
    expect(malformed.status).toBe(400);
    const foreign = await owner("tasks-route-foreign");
    const foreignSession = await createSession(db, foreign.id);
    const hidden = await getTaskRoute(
      sessionRequest(
        foreignSession.token,
        `/api/projects/${board.project.id}/tasks/${task.task.id}`,
      ),
      { params: Promise.resolve({ projectId: board.project.id, taskId: task.task.id }) },
    );
    expect(hidden.status).toBe(404);
    const malformedMutation = await getTaskRoute(
      sessionRequest(session.token, `/api/projects/${board.project.id}/tasks/not-a-uuid`),
      { params: Promise.resolve({ projectId: board.project.id, taskId: "not-a-uuid" }) },
    );
    expect(malformedMutation.status).toBe(400);
  });
});
