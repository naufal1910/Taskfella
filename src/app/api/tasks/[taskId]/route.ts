import { NextResponse } from "next/server";
import {
  getDatabase,
  parseJsonObject,
  parseOptionalJsonObject,
  taskJson,
  taskRoute,
} from "@/server/http/task-route";
import { getTask, serializeTask, trashTask, updateTask } from "@/server/modules/tasks/service";

type Context = { params: Promise<{ taskId: string }> };
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request, context: Context): Promise<NextResponse> {
  const { taskId } = await context.params;
  return taskRoute(request, async ({ account }) =>
    taskJson({ ok: true, task: serializeTask(await getTask(getDatabase(), account.id, taskId)) }),
  );
}

export async function PATCH(request: Request, context: Context): Promise<NextResponse> {
  const { taskId } = await context.params;
  return taskRoute(
    request,
    async ({ account }) => {
      const body = await parseJsonObject(request);
      return taskJson({
        ok: true,
        task: serializeTask(await updateTask(getDatabase(), account.id, taskId, body)),
      });
    },
    true,
  );
}

export async function DELETE(request: Request, context: Context): Promise<NextResponse> {
  const { taskId } = await context.params;
  return taskRoute(
    request,
    async ({ account }) => {
      await parseOptionalJsonObject(request);
      return taskJson({
        ok: true,
        task: serializeTask(await trashTask(getDatabase(), account.id, taskId)),
      });
    },
    true,
  );
}
