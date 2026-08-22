import { NextResponse } from "next/server";
import {
  getDatabase,
  parseOptionalJsonObject,
  taskJson,
  taskRoute,
} from "@/server/http/task-route";
import { restoreTask, serializeTask } from "@/server/modules/tasks/service";

type Context = { params: Promise<{ taskId: string }> };
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request, context: Context): Promise<NextResponse> {
  const { taskId } = await context.params;
  return taskRoute(
    request,
    async ({ account }) => {
      const body = await parseOptionalJsonObject(request);
      return taskJson({
        ok: true,
        task: serializeTask(
          await restoreTask(getDatabase(), account.id, taskId, body.warningConfirmed === true),
        ),
      });
    },
    true,
  );
}
