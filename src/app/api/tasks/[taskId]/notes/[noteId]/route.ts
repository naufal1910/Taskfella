import { NextResponse } from "next/server";
import {
  getDatabase,
  parseJsonObject,
  parseOptionalJsonObject,
  taskJson,
  taskRoute,
} from "@/server/http/task-route";
import { deleteNote, serializeTask, updateNote } from "@/server/modules/tasks/service";

type Context = { params: Promise<{ taskId: string; noteId: string }> };
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function PATCH(request: Request, context: Context): Promise<NextResponse> {
  const { taskId, noteId } = await context.params;
  return taskRoute(
    request,
    async ({ account }) => {
      const body = await parseJsonObject(request);
      return taskJson({
        ok: true,
        task: serializeTask(await updateNote(getDatabase(), account.id, taskId, noteId, body.body)),
      });
    },
    true,
  );
}

export async function DELETE(request: Request, context: Context): Promise<NextResponse> {
  const { taskId, noteId } = await context.params;
  return taskRoute(
    request,
    async ({ account }) => {
      await parseOptionalJsonObject(request);
      return taskJson({
        ok: true,
        task: serializeTask(await deleteNote(getDatabase(), account.id, taskId, noteId)),
      });
    },
    true,
  );
}
