import { NextResponse } from "next/server";
import { getDatabase, parseJsonObject, taskJson, taskRoute } from "@/server/http/task-route";
import { moveTask, serializeTask } from "@/server/modules/tasks/service";
import type { TaskMoveInput } from "@/server/modules/tasks/types";

type Context = { params: Promise<{ taskId: string }> };
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request, context: Context): Promise<NextResponse> {
  const { taskId } = await context.params;
  return taskRoute(
    request,
    async ({ account }) => {
      const body = await parseJsonObject(request);
      return taskJson({
        ok: true,
        task: serializeTask(
          await moveTask(getDatabase(), account.id, taskId, body as unknown as TaskMoveInput),
        ),
      });
    },
    true,
  );
}
