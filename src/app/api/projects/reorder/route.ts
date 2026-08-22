import { NextResponse } from "next/server";
import {
  getDatabase,
  parseJsonObject,
  projectJson,
  projectRoute,
} from "@/server/http/project-route";
import { reorderProjects } from "@/server/modules/projects/service";
import { normalizePosition } from "@/server/modules/projects/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function PATCH(request: Request): Promise<NextResponse> {
  return projectRoute(
    request,
    async ({ account }) => {
      const body = await parseJsonObject(request);
      if (typeof body.projectId !== "string" || body.position === undefined) {
        return projectJson(
          { error: { code: "INVALID_REQUEST", message: "The request could not be processed." } },
          400,
        );
      }
      const position = normalizePosition(body.position, 0);
      const projects = await reorderProjects(getDatabase(), account.id, body.projectId, position);
      return projectJson({ ok: true, projects });
    },
    true,
  );
}

export { PATCH as POST };
