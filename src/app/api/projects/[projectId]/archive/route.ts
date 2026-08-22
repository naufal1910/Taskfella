import { NextResponse } from "next/server";
import { getDatabase, projectJson, projectRoute } from "@/server/http/project-route";
import { archiveProject } from "@/server/modules/projects/service";

type Context = { params: Promise<{ projectId: string }> };

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request, context: Context): Promise<NextResponse> {
  const { projectId } = await context.params;
  return projectRoute(
    request,
    async ({ account }) => {
      const project = await archiveProject(getDatabase(), account.id, projectId);
      return projectJson({ ok: true, project });
    },
    true,
  );
}
