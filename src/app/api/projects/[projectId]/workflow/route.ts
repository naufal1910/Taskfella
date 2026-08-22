import { NextResponse } from "next/server";
import {
  getDatabase,
  parseJsonObject,
  projectJson,
  projectRoute,
} from "@/server/http/project-route";
import { configureColumns } from "@/server/modules/projects/service";
import {
  normalizeColumnName,
  normalizeCompletedGrouping,
  normalizeRole,
  normalizeWipLimit,
  normalizeWipMode,
  type ColumnDraft,
} from "@/server/modules/projects/types";

type Context = { params: Promise<{ projectId: string }> };

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function PATCH(request: Request, context: Context): Promise<NextResponse> {
  const { projectId } = await context.params;
  return projectRoute(
    request,
    async ({ account }) => {
      const body = await parseJsonObject(request);
      if (!Array.isArray(body.columns)) {
        return projectJson(
          { error: { code: "INVALID_REQUEST", message: "The request could not be processed." } },
          400,
        );
      }
      try {
        const drafts = body.columns.map((raw, position): ColumnDraft & { id: string } => {
          if (typeof raw !== "object" || raw === null) throw new Error("invalid");
          const column = raw as Record<string, unknown>;
          if (typeof column.id !== "string") throw new Error("invalid");
          const role = normalizeRole(column.role);
          const wipMode = normalizeWipMode(column.wipMode);
          return {
            id: column.id,
            name: normalizeColumnName(column.name),
            role,
            position,
            wipMode,
            wipLimit: normalizeWipLimit(column.wipLimit ?? null, wipMode),
            completedGrouping: normalizeCompletedGrouping(column.completedGrouping),
          };
        });
        const expectedRevision = body.expectedRevision;
        if (
          expectedRevision !== undefined &&
          (typeof expectedRevision !== "number" || !Number.isInteger(expectedRevision))
        )
          throw new Error("invalid");
        const project = await configureColumns(getDatabase(), account.id, projectId, drafts, {
          expectedRevision,
          confirmCompletionChanges: body.confirmCompletionChanges === true,
        });
        return projectJson({ ok: true, project });
      } catch (error) {
        if (error instanceof Error && error.message === "invalid") {
          return projectJson(
            { error: { code: "INVALID_REQUEST", message: "The request could not be processed." } },
            400,
          );
        }
        throw error;
      }
    },
    true,
  );
}
