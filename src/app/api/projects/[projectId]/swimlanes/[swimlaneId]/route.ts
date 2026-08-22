import { NextResponse } from "next/server";
import {
  expectedRevisionFrom,
  getDatabase,
  parseJsonObject,
  projectJson,
  projectRoute,
} from "@/server/http/project-route";
import { deleteSwimlane, updateSwimlane } from "@/server/modules/projects/service";

type Context = { params: Promise<{ projectId: string; swimlaneId: string }> };

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function PATCH(request: Request, context: Context): Promise<NextResponse> {
  const { projectId, swimlaneId } = await context.params;
  return projectRoute(
    request,
    async ({ account }) => {
      const body = await parseJsonObject(request);
      const project = await updateSwimlane(getDatabase(), account.id, projectId, swimlaneId, body, {
        expectedRevision: expectedRevisionFrom(body),
      });
      return projectJson({ ok: true, project });
    },
    true,
  );
}

export async function DELETE(request: Request, context: Context): Promise<NextResponse> {
  const { projectId, swimlaneId } = await context.params;
  return projectRoute(
    request,
    async ({ account }) => {
      const body = await parseJsonObject(request).catch(() => ({}) as Record<string, unknown>);
      const project = await deleteSwimlane(getDatabase(), account.id, projectId, swimlaneId, {
        expectedRevision: expectedRevisionFrom(body),
      });
      return projectJson({ ok: true, project });
    },
    true,
  );
}
