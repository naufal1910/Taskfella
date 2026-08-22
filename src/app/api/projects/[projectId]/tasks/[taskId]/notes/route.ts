import { NextResponse } from "next/server";
import { getDatabase, parseJsonObject, taskJson, taskRoute } from "@/server/http/task-route";
import { assertTaskInProject, createNote, serializeTask } from "@/server/modules/tasks/service";

type Context = { params: Promise<{ projectId: string; taskId: string }> };

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request, context: Context): Promise<NextResponse> {
  const { projectId, taskId } = await context.params;
  return taskRoute(
    request,
    async ({ account }) => {
      await assertTaskInProject(getDatabase(), account.id, projectId, taskId);
      const body = await parseJsonObject(request);
      const snapshot = await createNote(getDatabase(), account.id, taskId, body.body);
      return taskJson({ ok: true, task: serializeTask(snapshot) }, 201);
    },
    true,
  );
}
