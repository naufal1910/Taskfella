import { NextResponse } from "next/server";
import {
  getDatabase,
  parseJsonObject,
  projectJson,
  projectRoute,
} from "@/server/http/project-route";
import { permanentlyDeleteProject } from "@/server/modules/projects/service";

type Context = { params: Promise<{ projectId: string }> };

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Alias for clients that prefer an explicit destructive action route. */
export async function POST(request: Request, context: Context): Promise<NextResponse> {
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
