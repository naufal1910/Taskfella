import { NextResponse } from "next/server";
import { getDatabase, parseJsonObject, taskJson, taskRoute } from "@/server/http/task-route";
import { createNote, serializeTask } from "@/server/modules/tasks/service";

type Context = { params: Promise<{ taskId: string }> };
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request, context: Context): Promise<NextResponse> {
  const { taskId } = await context.params;
  return taskRoute(
    request,
    async ({ account }) => {
      const body = await parseJsonObject(request);
      return taskJson(
        {
          ok: true,
          task: serializeTask(await createNote(getDatabase(), account.id, taskId, body.body)),
        },
        201,
      );
    },
    true,
  );
}
