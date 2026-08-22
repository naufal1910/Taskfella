import { NextResponse } from "next/server";
import {
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
      const project = await updateSwimlane(getDatabase(), account.id, projectId, swimlaneId, body);
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
      await parseJsonObject(request).catch(() => ({}));
      const project = await deleteSwimlane(getDatabase(), account.id, projectId, swimlaneId);
      return projectJson({ ok: true, project });
    },
    true,
  );
}
