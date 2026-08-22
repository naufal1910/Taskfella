import { NextResponse } from "next/server";
import {
  getDatabase,
  parseJsonObject,
  projectJson,
  projectRoute,
} from "@/server/http/project-route";
import { addColumn } from "@/server/modules/projects/service";

type Context = { params: Promise<{ projectId: string }> };

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request, context: Context): Promise<NextResponse> {
  const { projectId } = await context.params;
  return projectRoute(
    request,
    async ({ account }) => {
      const body = await parseJsonObject(request);
      const expectedRevision =
        body.expectedRevision === undefined ? undefined : body.expectedRevision;
      if (
        expectedRevision !== undefined &&
        (typeof expectedRevision !== "number" || !Number.isInteger(expectedRevision))
      ) {
        return projectJson(
          { error: { code: "INVALID_REQUEST", message: "The request could not be processed." } },
          400,
        );
      }
      const project = await addColumn(getDatabase(), account.id, projectId, body, {
        expectedRevision,
        confirmCompletionChanges: body.confirmCompletionChanges === true,
      });
      return projectJson({ ok: true, project }, 201);
    },
    true,
  );
}
