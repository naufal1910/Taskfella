import { NextResponse } from "next/server";
import {
  expectedRevisionFrom,
  getDatabase,
  parseJsonObject,
  projectJson,
  projectRoute,
} from "@/server/http/project-route";
import { createSwimlane } from "@/server/modules/projects/service";

type Context = { params: Promise<{ projectId: string }> };

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request, context: Context): Promise<NextResponse> {
  const { projectId } = await context.params;
  return projectRoute(
    request,
    async ({ account }) => {
      const body = await parseJsonObject(request);
      const project = await createSwimlane(getDatabase(), account.id, projectId, body.name, {
        expectedRevision: expectedRevisionFrom(body),
      });
      return projectJson({ ok: true, project }, 201);
    },
    true,
  );
}
