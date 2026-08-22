import { NextResponse } from "next/server";
import {
  getDatabase,
  parseJsonObject,
  projectJson,
  projectRoute,
} from "@/server/http/project-route";
import { deleteLabel, updateLabel } from "@/server/modules/projects/service";

type Context = { params: Promise<{ projectId: string; labelId: string }> };

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function PATCH(request: Request, context: Context): Promise<NextResponse> {
  const { projectId, labelId } = await context.params;
  return projectRoute(
    request,
    async ({ account }) => {
      const body = await parseJsonObject(request);
      const project = await updateLabel(getDatabase(), account.id, projectId, labelId, body);
      return projectJson({ ok: true, project });
    },
    true,
  );
}

export async function DELETE(request: Request, context: Context): Promise<NextResponse> {
  const { projectId, labelId } = await context.params;
  return projectRoute(
    request,
    async ({ account }) => {
      await parseJsonObject(request).catch(() => ({}));
      const project = await deleteLabel(getDatabase(), account.id, projectId, labelId);
      return projectJson({ ok: true, project });
    },
    true,
  );
}
