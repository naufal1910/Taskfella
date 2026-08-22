import { NextResponse } from "next/server";
import {
  getDatabase,
  parseJsonObject,
  parseOptionalJsonObject,
  taskJson,
  taskRoute,
} from "@/server/http/task-route";
import { deleteSubtask, serializeTask, updateSubtask } from "@/server/modules/tasks/service";

type Context = { params: Promise<{ taskId: string; subtaskId: string }> };
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function PATCH(request: Request, context: Context): Promise<NextResponse> {
  const { taskId, subtaskId } = await context.params;
  return taskRoute(
    request,
    async ({ account }) => {
      const body = await parseJsonObject(request);
      return taskJson({
        ok: true,
        task: serializeTask(
          await updateSubtask(getDatabase(), account.id, taskId, subtaskId, body),
        ),
      });
    },
    true,
  );
}

export async function DELETE(request: Request, context: Context): Promise<NextResponse> {
  const { taskId, subtaskId } = await context.params;
  return taskRoute(
    request,
    async ({ account }) => {
      await parseOptionalJsonObject(request);
      return taskJson({
        ok: true,
        task: serializeTask(await deleteSubtask(getDatabase(), account.id, taskId, subtaskId)),
      });
    },
    true,
  );
}
