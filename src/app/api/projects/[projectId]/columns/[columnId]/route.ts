import { NextResponse } from "next/server";
import {
  getDatabase,
  parseJsonObject,
  parseOptionalJsonObject,
  projectJson,
  projectRoute,
} from "@/server/http/project-route";
import { deleteColumn, updateColumn } from "@/server/modules/projects/service";

type Context = { params: Promise<{ projectId: string; columnId: string }> };

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function optionsFrom(body: Record<string, unknown>) {
  const expectedRevision = body.expectedRevision;
  if (
    expectedRevision !== undefined &&
    (typeof expectedRevision !== "number" || !Number.isInteger(expectedRevision))
  )
    return null;
  return { expectedRevision, confirmCompletionChanges: body.confirmCompletionChanges === true };
}

export async function PATCH(request: Request, context: Context): Promise<NextResponse> {
  const { projectId, columnId } = await context.params;
  return projectRoute(
    request,
    async ({ account }) => {
      const body = await parseJsonObject(request);
      const options = optionsFrom(body);
      if (!options)
        return projectJson(
          { error: { code: "INVALID_REQUEST", message: "The request could not be processed." } },
          400,
        );
      const project = await updateColumn(
        getDatabase(),
        account.id,
        projectId,
        columnId,
        body,
        options,
      );
      return projectJson({ ok: true, project });
    },
    true,
  );
}

export async function DELETE(request: Request, context: Context): Promise<NextResponse> {
  const { projectId, columnId } = await context.params;
  return projectRoute(
    request,
    async ({ account }) => {
      const body = await parseOptionalJsonObject(request);
      const options = optionsFrom(body);
      if (!options)
        return projectJson(
          { error: { code: "INVALID_REQUEST", message: "The request could not be processed." } },
          400,
        );
      const project = await deleteColumn(getDatabase(), account.id, projectId, columnId, options);
      return projectJson({ ok: true, project });
    },
    true,
  );
}
