import { NextResponse } from "next/server";
import {
  getDatabase,
  parseJsonObject,
  projectJson,
  projectRoute,
} from "@/server/http/project-route";
import { deleteColumn, updateColumn } from "@/server/modules/projects/service";

type Context = { params: Promise<{ columnId: string }> };

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function optionsFrom(body: Record<string, unknown>) {
  const expectedRevision = body.expectedRevision;
  if (
    expectedRevision !== undefined &&
    (typeof expectedRevision !== "number" || !Number.isInteger(expectedRevision))
  ) {
    return null;
  }
  return {
    expectedRevision,
    confirmCompletionChanges: body.confirmCompletionChanges === true,
  };
}

export async function PATCH(request: Request, context: Context): Promise<NextResponse> {
  const { columnId } = await context.params;
  return projectRoute(
    request,
    async ({ account }) => {
      const body = await parseJsonObject(request);
      const projectId = body.projectId;
      if (typeof projectId !== "string") {
        return projectJson(
          { error: { code: "INVALID_REQUEST", message: "The request could not be processed." } },
          400,
        );
      }
      const options = optionsFrom(body);
      if (!options) {
        return projectJson(
          { error: { code: "INVALID_REQUEST", message: "The request could not be processed." } },
          400,
        );
      }
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
  const { columnId } = await context.params;
  return projectRoute(
    request,
    async ({ account }) => {
      const body = await parseJsonObject(request);
      if (typeof body.projectId !== "string") {
        return projectJson(
          { error: { code: "INVALID_REQUEST", message: "The request could not be processed." } },
          400,
        );
      }
      const options = optionsFrom(body);
      if (!options) {
        return projectJson(
          { error: { code: "INVALID_REQUEST", message: "The request could not be processed." } },
          400,
        );
      }
      const project = await deleteColumn(
        getDatabase(),
        account.id,
        body.projectId,
        columnId,
        options,
      );
      return projectJson({ ok: true, project });
    },
    true,
  );
}
