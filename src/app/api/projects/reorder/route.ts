import { NextResponse } from "next/server";
import {
  getDatabase,
  parseJsonObject,
  projectJson,
  projectRoute,
} from "@/server/http/project-route";
import { reorderProjects } from "@/server/modules/projects/service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function PATCH(request: Request): Promise<NextResponse> {
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
      const projects = await reorderProjects(
        getDatabase(),
        account.id,
        body.projectId,
        body.position,
      );
      return projectJson({ ok: true, projects });
    },
    true,
  );
}

export { PATCH as POST };
