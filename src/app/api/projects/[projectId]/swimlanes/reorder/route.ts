import { NextResponse } from "next/server";
import {
  expectedRevisionFrom,
  getDatabase,
  parseJsonObject,
  projectJson,
  projectRoute,
} from "@/server/http/project-route";
import { reorderSwimlanes } from "@/server/modules/projects/service";

type Context = { params: Promise<{ projectId: string }> };

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function PATCH(request: Request, context: Context): Promise<NextResponse> {
  const { projectId } = await context.params;
  return projectRoute(
    request,
    async ({ account }) => {
      const body = await parseJsonObject(request);
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

export { PATCH as POST };
