import { NextResponse } from "next/server";
import {
  expectedRevisionFrom,
  getDatabase,
  parseJsonObject,
  projectJson,
  projectRoute,
} from "@/server/http/project-route";
import { deleteLabel, reorderLabels, updateLabel } from "@/server/modules/projects/service";

type Context = { params: Promise<{ labelId: string }> };

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function PATCH(request: Request, context: Context): Promise<NextResponse> {
  const { labelId } = await context.params;
  return projectRoute(
    request,
    async ({ account }) => {
      const body = await parseJsonObject(request);
      if (typeof body.projectId !== "string")
        return projectJson(
          { error: { code: "INVALID_REQUEST", message: "The request could not be processed." } },
          400,
        );
      const project = await updateLabel(getDatabase(), account.id, body.projectId, labelId, body, {
        expectedRevision: expectedRevisionFrom(body),
      });
      return projectJson({ ok: true, project });
    },
    true,
  );
}

export async function DELETE(request: Request, context: Context): Promise<NextResponse> {
  const { labelId } = await context.params;
  return projectRoute(
    request,
    async ({ account }) => {
      const body = await parseJsonObject(request);
      if (typeof body.projectId !== "string")
        return projectJson(
          { error: { code: "INVALID_REQUEST", message: "The request could not be processed." } },
          400,
        );
      const project = await deleteLabel(getDatabase(), account.id, body.projectId, labelId, {
        expectedRevision: expectedRevisionFrom(body),
      });
      return projectJson({ ok: true, project });
    },
    true,
  );
}

export async function POST(request: Request, context: Context): Promise<NextResponse> {
  const { labelId } = await context.params;
  return projectRoute(
    request,
    async ({ account }) => {
      const body = await parseJsonObject(request);
      if (typeof body.projectId !== "string" || !Array.isArray(body.orderedIds))
        return projectJson(
          { error: { code: "INVALID_REQUEST", message: "The request could not be processed." } },
          400,
        );
      const project = await reorderLabels(
        getDatabase(),
        account.id,
        body.projectId,
        body.orderedIds,
        { expectedRevision: expectedRevisionFrom(body) },
      );
      return projectJson({ ok: true, project });
    },
    true,
  );
}
