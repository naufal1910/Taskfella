import { afterAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { getDatabase, closeDatabase } from "@/server/db/client";
import { projects, columns, projectLifecycleEvents, accounts } from "@/server/db/schema";
import { createAccount } from "@/server/modules/auth/accounts";
import { createSession } from "@/server/modules/auth/sessions";
import {
  addColumn,
  archiveProject,
  configureColumns,
  createLabel,
  createProject,
  createSwimlane,
  deleteColumn,
  permanentlyDeleteProject,
  reorderColumns,
  reorderProjects,
  restoreProject,
  updateColumn,
  updateLabel,
  updateSwimlane,
} from "@/server/modules/projects/service";
import { assertColumnWip } from "@/server/modules/workflow/wip";
import { DELETE as deleteProjectColumnRoute } from "@/app/api/projects/[projectId]/columns/[columnId]/route";
import { DELETE as deleteProjectLabelRoute } from "@/app/api/projects/[projectId]/labels/[labelId]/route";
import { DELETE as deleteProjectSwimlaneRoute } from "@/app/api/projects/[projectId]/swimlanes/[swimlaneId]/route";
import { GET as getProject } from "@/app/api/projects/[projectId]/route";
import { PATCH as configureWorkflowRoute } from "@/app/api/projects/[projectId]/workflow/route";
import { GET as listProjectsRoute, POST as createProjectRoute } from "@/app/api/projects/route";

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

function requestWithSession(session: string, path: string): Request {
  return new Request(`http://localhost:3000${path}`, {
    headers: { cookie: `taskfella_session=${session}` },
  });
}

function mutationWithSession(
  session: string,
  path: string,
  body: unknown,
  method = "POST",
): Request {
  return rawMutationWithSession(session, path, JSON.stringify(body), method);
}

function rawMutationWithSession(
  session: string,
  path: string,
  body: string | undefined,
  method = "DELETE",
): Request {
  const csrf = `csrf-${crypto.randomUUID()}`;
  const init: RequestInit = {
    method,
    headers: {
      origin: "http://localhost:3000",
      cookie: `taskfella_session=${session}; taskfella_csrf=${csrf}`,
      "x-csrf-token": csrf,
      "content-type": "application/json",
    },
  };
  if (body !== undefined) init.body = body;
  return new Request(`http://localhost:3000${path}`, init);
}

integration("Phase 2 projects and workflow transactions", () => {
  afterAll(async () => {
    if (!db) return;
    for (const accountId of accountIds) {
      await db.delete(accounts).where(eq(accounts.id, accountId));
    }
    await closeDatabase();
  });

  it("creates valid Personal, Simple, and Blank workflows", async () => {
    if (!db) return;
    const account = await owner("templates");
    const personal = await createProject(db, account.id, {
      name: "Personal board",
      template: "personal",
    });
    const simple = await createProject(db, account.id, {
      name: "Simple board",
      template: "simple",
    });
    const blank = await createProject(db, account.id, {
      name: "Blank board",
      template: "blank",
    });

    expect(personal.columns.map((column) => column.name)).toEqual([
      "Backlog",
      "Today",
      "In Progress",
      "Review",
      "Done",
    ]);
    expect(simple.columns.map((column) => column.name)).toEqual(["To Do", "In Progress", "Done"]);
    expect(blank.columns.map((column) => column.name)).toEqual(["In Progress", "Done"]);
    for (const snapshot of [personal, simple, blank]) {
      expect(snapshot.columns.filter((column) => column.role === "active")).toHaveLength(1);
      expect(
        snapshot.columns.filter((column) => column.role === "completed").length,
      ).toBeGreaterThanOrEqual(1);
      expect(snapshot.project.status).toBe("active");
      expect(snapshot.lifecycle.map((event) => event.event)).toEqual(["created"]);
    }
  });

  it("exposes authenticated project list and creation routes with board data", async () => {
    if (!db) return;
    const account = await owner("routes");
    const session = await createSession(db, account.id);
    const created = await createProjectRoute(
      mutationWithSession(session.token, "/api/projects", {
        name: "Route board",
        template: "blank",
      }),
    );
    expect(created.status).toBe(201);
    const createdBody = await created.json();
    expect(createdBody).toMatchObject({
      ok: true,
      project: { name: "Route board", columns: [{ role: "active" }, { role: "completed" }] },
    });
    const malformedColumns = await createProjectRoute(
      mutationWithSession(session.token, "/api/projects", {
        name: "Malformed board",
        template: "blank",
        columns: [{ name: "Ready", role: "active" }, null, { name: "Done", role: "completed" }],
      }),
    );
    expect(malformedColumns.status).toBe(400);
    expect(await malformedColumns.json()).toMatchObject({
      error: { code: "INVALID_REQUEST" },
    });
    const listed = await listProjectsRoute(requestWithSession(session.token, "/api/projects"));
    expect(listed.status).toBe(200);
    expect(await listed.json()).toMatchObject({
      projects: [{ name: "Route board", columnCount: 2 }],
    });
    const createdProject = createdBody.project as {
      id: string;
      revision: number;
      columns: Array<Record<string, unknown>>;
    };
    const renamed = await configureWorkflowRoute(
      mutationWithSession(
        session.token,
        `/api/projects/${createdProject.id}/workflow`,
        {
          expectedRevision: createdProject.revision,
          columns: createdProject.columns.map((column, position) => ({
            ...column,
            name: position === 0 ? "Ready" : column.name,
            position,
          })),
        },
        "PATCH",
      ),
      { params: Promise.resolve({ projectId: createdProject.id }) },
    );
    expect(renamed.status).toBe(200);
    expect((await renamed.json()).project.columns[0].name).toBe("Ready");

    const invalidProject = await getProject(
      requestWithSession(session.token, "/api/projects/not-a-uuid"),
      { params: Promise.resolve({ projectId: "not-a-uuid" }) },
    );
    expect(invalidProject.status).toBe(400);
    expect(await invalidProject.json()).toMatchObject({ error: { code: "INVALID_REQUEST" } });
  });

  it("scopes reads and project lists to the authenticated account", async () => {
    if (!db) return;
    const account = await owner("isolation-owner");
    const foreign = await owner("isolation-foreign");
    const project = await createProject(db, account.id, {
      name: "Private board",
      template: "simple",
    });
    await expect(
      db.insert(projectLifecycleEvents).values({
        projectId: project.project.id,
        accountId: foreign.id,
        event: "created",
      }),
    ).rejects.toThrow();
    const session = await createSession(db, foreign.id);
    const response = await getProject(
      requestWithSession(session.token, `/api/projects/${project.project.id}`),
      {
        params: Promise.resolve({ projectId: project.project.id }),
      },
    );
    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({ error: { code: "NOT_FOUND" } });
  });

  it("preserves account-owned project ordering across lifecycle changes", async () => {
    if (!db) return;
    const account = await owner("project-order");
    const first = await createProject(db, account.id, { name: "First", template: "blank" });
    const second = await createProject(db, account.id, { name: "Second", template: "blank" });
    const third = await createProject(db, account.id, { name: "Third", template: "blank" });
    await archiveProject(db, account.id, first.project.id);
    const fourth = await createProject(db, account.id, { name: "Fourth", template: "blank" });
    const reordered = await reorderProjects(db, account.id, fourth.project.id, 0);
    expect(reordered.map((project) => project.name)).toEqual(["Fourth", "Second", "Third"]);
    expect(reordered.map((project) => project.position)).toEqual([0, 1, 2]);
    expect(second.project.accountId).toBe(account.id);
  });

  it("customizes columns, lanes, labels, WIP, and ordering without breaking invariants", async () => {
    if (!db) return;
    const account = await owner("customize");
    const created = await createProject(db, account.id, {
      name: "Custom board",
      template: "simple",
    });
    const session = await createSession(db, account.id);
    const active = created.columns.find((column) => column.role === "active");
    const completed = created.columns.find((column) => column.role === "completed");
    const queued = created.columns.find((column) => column.role === "queued");
    if (!active || !completed || !queued) throw new Error("template columns missing");

    const withWip = await updateColumn(
      db,
      account.id,
      created.project.id,
      active.id,
      {
        wipMode: "warn",
        wipLimit: 3,
      },
      { expectedRevision: created.project.revision },
    );
    expect(withWip.columns.find((column) => column.id === active.id)).toMatchObject({
      wipMode: "warn",
      wipLimit: 3,
    });
    await expect(
      assertColumnWip(
        db,
        account.id,
        created.project.id,
        active.id,
        async () => 3,
        async (_tx, evaluation) => evaluation,
      ),
    ).rejects.toMatchObject({ code: "WIP_CONFIRMATION_REQUIRED" });
    await expect(
      assertColumnWip(
        db,
        account.id,
        created.project.id,
        active.id,
        async () => 3,
        async (_tx, evaluation) => evaluation,
        true,
      ),
    ).resolves.toMatchObject({ allowed: true, warning: true });

    const withoutWip = await updateColumn(
      db,
      account.id,
      created.project.id,
      active.id,
      { wipMode: "none", wipLimit: null },
      { expectedRevision: withWip.project.revision },
    );
    expect(withoutWip.columns.find((column) => column.id === active.id)).toMatchObject({
      wipMode: "none",
      wipLimit: null,
    });

    await expect(
      updateColumn(
        db,
        account.id,
        created.project.id,
        queued.id,
        { role: "completed" },
        { expectedRevision: withoutWip.project.revision },
      ),
    ).rejects.toMatchObject({ code: "WORKFLOW_CONFIRMATION_REQUIRED" });
    const roleChanged = await updateColumn(
      db,
      account.id,
      created.project.id,
      queued.id,
      { role: "review" },
      { expectedRevision: withoutWip.project.revision },
    );
    expect(roleChanged.columns.filter((column) => column.role === "active")).toHaveLength(1);
    expect(roleChanged.columns.filter((column) => column.role === "completed")).toHaveLength(1);

    const added = await addColumn(
      db,
      account.id,
      created.project.id,
      { name: "Waiting", role: "neutral" },
      { expectedRevision: roleChanged.project.revision },
    );
    const waiting = added.columns.find((column) => column.name === "Waiting");
    if (!waiting) throw new Error("new column missing");
    const movedByPatch = await updateColumn(
      db,
      account.id,
      created.project.id,
      waiting.id,
      { position: 0 },
      { expectedRevision: added.project.revision },
    );
    expect(movedByPatch.columns[0]?.id).toBe(waiting.id);

    const reordered = await reorderColumns(
      db,
      account.id,
      created.project.id,
      [
        waiting.id,
        ...movedByPatch.columns
          .filter((column) => column.id !== waiting.id)
          .map((column) => column.id),
      ],
      { expectedRevision: movedByPatch.project.revision },
    );
    expect(reordered.columns[0]?.id).toBe(waiting.id);

    const lane = await createSwimlane(db, account.id, created.project.id, "Personal");
    const secondLane = await createSwimlane(db, account.id, created.project.id, "Later", {
      expectedRevision: lane.project.revision,
    });
    const movedLane = await updateSwimlane(
      db,
      account.id,
      created.project.id,
      lane.swimlanes[0]!.id,
      { position: 1 },
      { expectedRevision: secondLane.project.revision },
    );
    expect(movedLane.swimlanes.map((item) => item.name)).toEqual(["Later", "Personal"]);
    expect(movedLane.swimlanes.map((item) => item.position)).toEqual([0, 1]);

    const withLabel = await createLabel(
      db,
      account.id,
      created.project.id,
      { name: "Focus", color: "#176B51" },
      { expectedRevision: movedLane.project.revision },
    );
    const secondLabel = await createLabel(
      db,
      account.id,
      created.project.id,
      { name: "Later focus", color: "#246BCE" },
      { expectedRevision: withLabel.project.revision },
    );
    const movedLabel = await updateLabel(
      db,
      account.id,
      created.project.id,
      withLabel.labels[0]!.id,
      { position: 1 },
      { expectedRevision: secondLabel.project.revision },
    );
    expect(movedLabel.labels.map((item) => item.name)).toEqual(["Later focus", "Focus"]);
    expect(movedLabel.labels.map((item) => item.position)).toEqual([0, 1]);
    await expect(
      updateSwimlane(
        db,
        account.id,
        created.project.id,
        lane.swimlanes[0]!.id,
        { name: "Stale" },
        { expectedRevision: lane.project.revision },
      ),
    ).rejects.toMatchObject({ code: "CONCURRENT_UPDATE" });

    const deleted = await deleteColumn(db, account.id, created.project.id, waiting.id, {
      expectedRevision: movedLabel.project.revision,
    });
    expect(deleted.columns.some((column) => column.id === waiting.id)).toBe(false);

    const labelId = movedLabel.labels[0]!.id;
    const malformedLabelDelete = await deleteProjectLabelRoute(
      rawMutationWithSession(
        session.token,
        `/api/projects/${created.project.id}/labels/${labelId}`,
        "{malformed",
      ),
      { params: Promise.resolve({ projectId: created.project.id, labelId }) },
    );
    expect(malformedLabelDelete.status).toBe(400);
    const emptyLabelDelete = await deleteProjectLabelRoute(
      rawMutationWithSession(
        session.token,
        `/api/projects/${created.project.id}/labels/${labelId}`,
        undefined,
      ),
      { params: Promise.resolve({ projectId: created.project.id, labelId }) },
    );
    expect(emptyLabelDelete.status).toBe(200);

    const bodylessColumn = await addColumn(db, account.id, created.project.id, {
      name: "Bodyless delete",
      role: "neutral",
    });
    const bodylessColumnId = bodylessColumn.columns.find(
      (column) => column.name === "Bodyless delete",
    )!.id;
    const malformedColumnDelete = await deleteProjectColumnRoute(
      rawMutationWithSession(
        session.token,
        `/api/projects/${created.project.id}/columns/${bodylessColumnId}`,
        "{malformed",
      ),
      { params: Promise.resolve({ projectId: created.project.id, columnId: bodylessColumnId }) },
    );
    expect(malformedColumnDelete.status).toBe(400);
    const emptyColumnDelete = await deleteProjectColumnRoute(
      rawMutationWithSession(
        session.token,
        `/api/projects/${created.project.id}/columns/${bodylessColumnId}`,
        undefined,
      ),
      { params: Promise.resolve({ projectId: created.project.id, columnId: bodylessColumnId }) },
    );
    expect(emptyColumnDelete.status).toBe(200);
    expect((await emptyColumnDelete.json()).project.columns).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ id: bodylessColumnId })]),
    );

    const swimlaneId = movedLabel.swimlanes[0]!.id;
    const malformedSwimlaneDelete = await deleteProjectSwimlaneRoute(
      rawMutationWithSession(
        session.token,
        `/api/projects/${created.project.id}/swimlanes/${swimlaneId}`,
        "{malformed",
      ),
      { params: Promise.resolve({ projectId: created.project.id, swimlaneId }) },
    );
    expect(malformedSwimlaneDelete.status).toBe(400);
    const emptySwimlaneDelete = await deleteProjectSwimlaneRoute(
      rawMutationWithSession(
        session.token,
        `/api/projects/${created.project.id}/swimlanes/${swimlaneId}`,
        undefined,
      ),
      { params: Promise.resolve({ projectId: created.project.id, swimlaneId }) },
    );
    expect(emptySwimlaneDelete.status).toBe(200);
  });

  it("rejects invalid workflow configurations before commit and the database trigger rejects raw invalid writes", async () => {
    if (!db) return;
    const account = await owner("invariants");
    const snapshot = await createProject(db, account.id, {
      name: "Invariant board",
      template: "simple",
    });
    const invalid = snapshot.columns.map((column) => ({
      id: column.id,
      name: column.name,
      role: "neutral" as const,
      position: column.position,
      wipMode: column.wipMode as "none" | "warn" | "enforce",
      wipLimit: column.wipLimit,
      completedGrouping: column.completedGrouping as "list" | "date",
    }));
    await expect(
      configureColumns(db, account.id, snapshot.project.id, invalid, {
        expectedRevision: snapshot.project.revision,
      }),
    ).rejects.toMatchObject({ code: "BOARD_INVARIANT_VIOLATION" });
    const afterApplicationRejection = await db
      .select({ role: columns.role })
      .from(columns)
      .where(eq(columns.projectId, snapshot.project.id));
    expect(afterApplicationRejection.map((row) => row.role).sort()).toEqual([
      "active",
      "completed",
      "queued",
    ]);

    const completed = snapshot.columns.find((column) => column.role === "completed");
    if (!completed) throw new Error("completed column missing");
    await expect(
      deleteColumn(db, account.id, snapshot.project.id, completed.id, {
        expectedRevision: snapshot.project.revision,
      }),
    ).rejects.toMatchObject({ code: "BOARD_INVARIANT_VIOLATION" });

    const reassignmentTarget = await createProject(db, account.id, {
      name: "Reassignment target",
      template: "blank",
    });
    await expect(
      db.transaction(async (tx) => {
        await tx
          .update(columns)
          .set({ projectId: reassignmentTarget.project.id })
          .where(eq(columns.id, completed.id));
      }),
    ).rejects.toThrow(/exactly one active column and at least one completed column/);

    await expect(
      db.transaction(async (tx) => {
        await tx
          .update(columns)
          .set({ role: "neutral" })
          .where(eq(columns.projectId, snapshot.project.id));
      }),
    ).rejects.toThrow(/exactly one active column/);
    const afterRawRejection = await db
      .select({ role: columns.role })
      .from(columns)
      .where(eq(columns.projectId, snapshot.project.id));
    expect(afterRawRejection.map((row) => row.role).sort()).toEqual([
      "active",
      "completed",
      "queued",
    ]);
  });

  it("serializes concurrent workflow changes and preserves project lifecycle history", async () => {
    if (!db) return;
    const account = await owner("lifecycle");
    const snapshot = await createProject(db, account.id, {
      name: "Retained board",
      template: "simple",
    });
    const [first, second] = await Promise.allSettled([
      updateColumn(
        db,
        account.id,
        snapshot.project.id,
        snapshot.columns[0]!.id,
        { name: "Queue A" },
        { expectedRevision: snapshot.project.revision },
      ),
      updateColumn(
        db,
        account.id,
        snapshot.project.id,
        snapshot.columns[0]!.id,
        { name: "Queue B" },
        { expectedRevision: snapshot.project.revision },
      ),
    ]);
    expect([first.status, second.status].sort()).toEqual(["fulfilled", "rejected"]);
    const archived = await archiveProject(db, account.id, snapshot.project.id);
    expect(archived.project.status).toBe("archived");
    expect(archived.columns).toHaveLength(3);
    await expect(
      updateColumn(
        db,
        account.id,
        snapshot.project.id,
        archived.columns[0]!.id,
        { name: "Blocked" },
        { expectedRevision: archived.project.revision },
      ),
    ).rejects.toMatchObject({ code: "PROJECT_ARCHIVED" });
    const restored = await restoreProject(db, account.id, snapshot.project.id);
    expect(restored.project.status).toBe("active");
    expect(restored.columns).toHaveLength(3);
    expect(restored.lifecycle.map((event) => event.event)).toEqual([
      "created",
      "archived",
      "restored",
    ]);

    await expect(
      permanentlyDeleteProject(db, account.id, snapshot.project.id, "wrong"),
    ).rejects.toMatchObject({ code: "PERMANENT_DELETE_CONFIRMATION_REQUIRED" });
    expect(
      await db.select().from(projects).where(eq(projects.id, snapshot.project.id)),
    ).toHaveLength(1);
    await permanentlyDeleteProject(db, account.id, snapshot.project.id, "Retained board");
    expect(
      await db.select().from(projects).where(eq(projects.id, snapshot.project.id)),
    ).toHaveLength(0);
    expect(
      await db
        .select()
        .from(projectLifecycleEvents)
        .where(eq(projectLifecycleEvents.projectId, snapshot.project.id)),
    ).toHaveLength(0);
  });
});
