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
  getTask,
  serializeTask,
  trashTask,
  updateTask,
} from "@/server/modules/tasks/service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Context = { params: Promise<{ projectId: string; taskId: string }> };

export async function GET(request: Request, context: Context): Promise<NextResponse> {
  const { projectId, taskId } = await context.params;
  return taskRoute(request, async ({ account }) => {
    await assertTaskInProject(getDatabase(), account.id, projectId, taskId);
    const snapshot = await getTask(getDatabase(), account.id, taskId);
    return taskJson({ ok: true, task: serializeTask(snapshot) });
  });
}

export async function PATCH(request: Request, context: Context): Promise<NextResponse> {
  const { projectId, taskId } = await context.params;
  return taskRoute(
    request,
    async ({ account }) => {
      await assertTaskInProject(getDatabase(), account.id, projectId, taskId);
      const body = await parseJsonObject(request);
      const snapshot = await updateTask(getDatabase(), account.id, taskId, body);
      return taskJson({ ok: true, task: serializeTask(snapshot) });
    },
    true,
  );
}

export async function DELETE(request: Request, context: Context): Promise<NextResponse> {
  const { projectId, taskId } = await context.params;
  return taskRoute(
    request,
    async ({ account }) => {
      await assertTaskInProject(getDatabase(), account.id, projectId, taskId);
      await parseOptionalJsonObject(request);
      const snapshot = await trashTask(getDatabase(), account.id, taskId);
      return taskJson({ ok: true, task: serializeTask(snapshot) });
    },
    true,
  );
}
