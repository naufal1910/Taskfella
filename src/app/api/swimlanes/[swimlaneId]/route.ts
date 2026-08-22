import { NextResponse } from "next/server";
import {
  expectedRevisionFrom,
  getDatabase,
  parseJsonObject,
  projectJson,
  projectRoute,
} from "@/server/http/project-route";
import {
  deleteSwimlane,
  reorderSwimlanes,
  updateSwimlane,
} from "@/server/modules/projects/service";

type Context = { params: Promise<{ swimlaneId: string }> };

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function projectIdFrom(body: Record<string, unknown>): string | null {
  return typeof body.projectId === "string" ? body.projectId : null;
}

export async function PATCH(request: Request, context: Context): Promise<NextResponse> {
  const { swimlaneId } = await context.params;
  return projectRoute(
    request,
    async ({ account }) => {
      const body = await parseJsonObject(request);
      const projectId = projectIdFrom(body);
      if (!projectId)
        return projectJson(
          { error: { code: "INVALID_REQUEST", message: "The request could not be processed." } },
          400,
        );
      const project = await updateSwimlane(getDatabase(), account.id, projectId, swimlaneId, body, {
        expectedRevision: expectedRevisionFrom(body),
      });
      return projectJson({ ok: true, project });
    },
    true,
  );
}

export async function DELETE(request: Request, context: Context): Promise<NextResponse> {
  const { swimlaneId } = await context.params;
  return projectRoute(
    request,
    async ({ account }) => {
      const body = await parseJsonObject(request);
      const projectId = projectIdFrom(body);
      if (!projectId)
        return projectJson(
          { error: { code: "INVALID_REQUEST", message: "The request could not be processed." } },
          400,
        );
      const project = await deleteSwimlane(getDatabase(), account.id, projectId, swimlaneId, {
        expectedRevision: expectedRevisionFrom(body),
      });
      return projectJson({ ok: true, project });
    },
    true,
  );
}

export async function POST(request: Request, context: Context): Promise<NextResponse> {
  const { swimlaneId } = await context.params;
  return projectRoute(
    request,
    async ({ account }) => {
      const body = await parseJsonObject(request);
      const projectId = projectIdFrom(body);
      if (!projectId || !Array.isArray(body.orderedIds))
        return projectJson(
          { error: { code: "INVALID_REQUEST", message: "The request could not be processed." } },
          400,
        );
      const project = await reorderSwimlanes(
        getDatabase(),
        account.id,
        projectId,
        body.orderedIds,
        { expectedRevision: expectedRevisionFrom(body) },
      );
      return projectJson({ ok: true, project });
    },
    true,
  );
}
