import { NextResponse } from "next/server";
import { getDatabase } from "@/server/db/client";
import { protectedRoute, type AuthenticatedAccount } from "@/server/http/authentication";
import { parseJsonObject } from "@/server/http/auth-route";
import { AppError } from "@/server/http/errors";
import { serializeProject, type ProjectSnapshot } from "@/server/modules/projects/service";

function serializeProjectBody(body: unknown): unknown {
  if (typeof body !== "object" || body === null || !("project" in body)) return body;
  const candidate = body as { project?: unknown };
  if (
    typeof candidate.project !== "object" ||
    candidate.project === null ||
    !("project" in candidate.project) ||
    !("columns" in candidate.project)
  ) {
    return body;
  }
  return { ...body, project: serializeProject(candidate.project as ProjectSnapshot) };
}

export function projectJson(body: unknown, status = 200): NextResponse {
  return NextResponse.json(serializeProjectBody(body), {
    status,
    headers: { "cache-control": "no-store" },
  });
}

export function expectedRevisionFrom(body: Record<string, unknown>): number | undefined {
  const expectedRevision = body.expectedRevision;
  if (
    expectedRevision !== undefined &&
    (typeof expectedRevision !== "number" ||
      !Number.isInteger(expectedRevision) ||
      expectedRevision < 0)
  ) {
    throw new AppError("INVALID_REQUEST");
  }
  return expectedRevision;
}

export function projectRoute(
  request: Request,
  handler: (authenticated: AuthenticatedAccount) => Promise<NextResponse>,
  mutation = false,
): Promise<NextResponse> {
  return protectedRoute(request, handler, { mutation });
}

export { getDatabase, parseJsonObject };
