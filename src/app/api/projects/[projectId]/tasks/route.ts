import { NextResponse } from "next/server";
import { getDatabase, parseJsonObject, taskJson, taskRoute } from "@/server/http/task-route";
import { createTask, listTasks, serializeTask } from "@/server/modules/tasks/service";
import type { TaskCreateInput } from "@/server/modules/tasks/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const revalidate = 0;

type Context = { params: Promise<{ projectId: string }> };

export async function GET(request: Request, context: Context): Promise<NextResponse> {
  const { projectId } = await context.params;
  return taskRoute(request, async ({ account }) => {
    const query = new URL(request.url).searchParams;
    const trash = query.get("trash");
    if (trash !== null && trash !== "true" && trash !== "false") {
      return taskJson(
        { error: { code: "INVALID_REQUEST", message: "The request could not be processed." } },
        400,
      );
    }
    const tasks = await listTasks(getDatabase(), account.id, projectId, {
      search: query.get("search") ?? undefined,
      labelId: query.get("labelId") ?? undefined,
      color: query.get("color") ?? undefined,
      due: query.get("due") ?? undefined,
      columnId: query.get("columnId") ?? undefined,
      swimlaneId:
        query.get("swimlaneId") === "none" ? null : (query.get("swimlaneId") ?? undefined),
      includeTrash: trash === "true",
      timezone: account.timezone,
    });
    return taskJson({ ok: true, tasks });
  });
}

export async function POST(request: Request, context: Context): Promise<NextResponse> {
  const { projectId } = await context.params;
  return taskRoute(
    request,
    async ({ account }) => {
      const body = await parseJsonObject(request);
      const snapshot = await createTask(
        getDatabase(),
        account.id,
        projectId,
        body as unknown as TaskCreateInput,
      );
      return taskJson({ ok: true, task: serializeTask(snapshot) }, 201);
    },
    true,
  );
}
