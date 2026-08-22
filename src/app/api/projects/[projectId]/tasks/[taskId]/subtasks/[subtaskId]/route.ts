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
  deleteSubtask,
  serializeTask,
  updateSubtask,
} from "@/server/modules/tasks/service";

type Context = { params: Promise<{ projectId: string; taskId: string; subtaskId: string }> };

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function PATCH(request: Request, context: Context): Promise<NextResponse> {
  const { projectId, taskId, subtaskId } = await context.params;
  return taskRoute(
    request,
    async ({ account }) => {
      await assertTaskInProject(getDatabase(), account.id, projectId, taskId);
      const body = await parseJsonObject(request);
      const snapshot = await updateSubtask(getDatabase(), account.id, taskId, subtaskId, body);
      return taskJson({ ok: true, task: serializeTask(snapshot) });
    },
    true,
  );
}

export async function DELETE(request: Request, context: Context): Promise<NextResponse> {
  const { projectId, taskId, subtaskId } = await context.params;
  return taskRoute(
    request,
    async ({ account }) => {
      await assertTaskInProject(getDatabase(), account.id, projectId, taskId);
      await parseOptionalJsonObject(request);
      const snapshot = await deleteSubtask(getDatabase(), account.id, taskId, subtaskId);
      return taskJson({ ok: true, task: serializeTask(snapshot) });
    },
    true,
  );
}
