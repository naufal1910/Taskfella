import { NextResponse } from "next/server";
import {
  getDatabase,
  parseJsonObject,
  parseOptionalJsonObject,
  taskJson,
  taskRoute,
} from "@/server/http/task-route";
import {
  assertTaskInProject,
  deleteNote,
  serializeTask,
  updateNote,
} from "@/server/modules/tasks/service";

type Context = { params: Promise<{ projectId: string; taskId: string; noteId: string }> };

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function PATCH(request: Request, context: Context): Promise<NextResponse> {
  const { projectId, taskId, noteId } = await context.params;
  return taskRoute(
    request,
    async ({ account }) => {
      await assertTaskInProject(getDatabase(), account.id, projectId, taskId);
      const body = await parseJsonObject(request);
      const snapshot = await updateNote(getDatabase(), account.id, taskId, noteId, body.body);
      return taskJson({ ok: true, task: serializeTask(snapshot) });
    },
    true,
  );
}

export async function DELETE(request: Request, context: Context): Promise<NextResponse> {
  const { projectId, taskId, noteId } = await context.params;
  return taskRoute(
    request,
    async ({ account }) => {
      await assertTaskInProject(getDatabase(), account.id, projectId, taskId);
      await parseOptionalJsonObject(request);
      const snapshot = await deleteNote(getDatabase(), account.id, taskId, noteId);
      return taskJson({ ok: true, task: serializeTask(snapshot) });
    },
    true,
  );
}
