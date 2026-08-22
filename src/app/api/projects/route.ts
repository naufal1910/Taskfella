import { NextResponse } from "next/server";
import {
  getDatabase,
  parseJsonObject,
  projectJson,
  projectRoute,
} from "@/server/http/project-route";
import { createProject, projectListPayload } from "@/server/modules/projects/service";
import { normalizeProjectTemplate, type ProjectCreateInput } from "@/server/modules/projects/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const revalidate = 0;

export async function GET(request: Request): Promise<NextResponse> {
  return projectRoute(request, async ({ account }) => {
    const projects = await projectListPayload(getDatabase(), account.id);
    return projectJson({ ok: true, projects });
  });
}

export async function POST(request: Request): Promise<NextResponse> {
  return projectRoute(
    request,
    async ({ account }) => {
      const body = await parseJsonObject(request);
      const template = normalizeProjectTemplate(body.template);
      const columns =
        body.columns === undefined
          ? undefined
          : Array.isArray(body.columns)
            ? body.columns
                .filter(
                  (column): column is Record<string, unknown> =>
                    typeof column === "object" && column !== null,
                )
                .map((column) => ({
                  name: column.name as string,
                  role: column.role as never,
                  position: column.position as never,
                  wipMode: column.wipMode as never,
                  wipLimit: column.wipLimit as never,
                  completedGrouping: column.completedGrouping as never,
                }))
            : undefined;
      if (body.columns !== undefined && columns === undefined) {
        return projectJson(
          { error: { code: "INVALID_REQUEST", message: "The request could not be processed." } },
          400,
        );
      }
      const input: ProjectCreateInput = {
        name: body.name as string,
        description: body.description as string | undefined,
        template,
        columns,
      };
      const snapshot = await createProject(getDatabase(), account.id, input);
      return projectJson({ ok: true, project: snapshot }, 201);
    },
    true,
  );
}
