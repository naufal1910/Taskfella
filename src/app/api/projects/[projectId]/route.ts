import { NextResponse } from "next/server";
import {
  getDatabase,
  parseJsonObject,
  projectJson,
  projectRoute,
} from "@/server/http/project-route";
import {
  getConsistentProjectSnapshot,
  permanentlyDeleteProject,
  updateProject,
} from "@/server/modules/projects/service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const revalidate = 0;

type Context = { params: Promise<{ projectId: string }> };

export async function GET(request: Request, context: Context): Promise<NextResponse> {
  const { projectId } = await context.params;
  return projectRoute(request, async ({ account }) => {
    const project = await getConsistentProjectSnapshot(getDatabase(), account.id, projectId);
    return projectJson({ ok: true, project });
  });
}

export async function PATCH(request: Request, context: Context): Promise<NextResponse> {
  const { projectId } = await context.params;
  return projectRoute(
    request,
    async ({ account }) => {
      const body = await parseJsonObject(request);
      const expectedRevision =
        body.expectedRevision === undefined
          ? undefined
          : typeof body.expectedRevision === "number" && Number.isInteger(body.expectedRevision)
            ? body.expectedRevision
            : NaN;
      if (Number.isNaN(expectedRevision)) {
        return projectJson(
          { error: { code: "INVALID_REQUEST", message: "The request could not be processed." } },
          400,
        );
      }
      const project = await updateProject(getDatabase(), account.id, projectId, {
        name: body.name as string | undefined,
        description: body.description as string | undefined,
        expectedRevision,
      });
      return projectJson({ ok: true, project });
    },
    true,
  );
}

/**
 * Permanent deletion is intentionally not a one-click action. The request
 * must carry the exact project name typed by the user.
 */
export async function DELETE(request: Request, context: Context): Promise<NextResponse> {
  const { projectId } = await context.params;
  return projectRoute(
    request,
    async ({ account }) => {
      const body = await parseJsonObject(request);
      await permanentlyDeleteProject(getDatabase(), account.id, projectId, body.confirmation);
      return projectJson({ ok: true });
    },
    true,
  );
}
