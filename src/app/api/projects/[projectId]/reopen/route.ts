import { NextResponse } from "next/server";
import { getDatabase, projectJson, projectRoute } from "@/server/http/project-route";
import { restoreProject } from "@/server/modules/projects/service";

type Context = { params: Promise<{ projectId: string }> };

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Reopen is the product-language alias for restoring an archived project. */
export async function POST(request: Request, context: Context): Promise<NextResponse> {
  const { projectId } = await context.params;
  return projectRoute(
    request,
    async ({ account }) => {
      const project = await restoreProject(getDatabase(), account.id, projectId);
      return projectJson({ ok: true, project });
    },
    true,
  );
}
