import { NextResponse } from "next/server";
import { getDatabase } from "@/server/db/client";
import { protectedRoute, type AuthenticatedAccount } from "@/server/http/authentication";
import { parseJsonObject, parseOptionalJsonObject } from "@/server/http/auth-route";
import { AppError } from "@/server/http/errors";

export function taskJson(body: unknown, status = 200): NextResponse {
  return NextResponse.json(body, {
    status,
    headers: { "cache-control": "no-store" },
  });
}

export function taskRoute(
  request: Request,
  handler: (authenticated: AuthenticatedAccount) => Promise<NextResponse>,
  mutation = false,
): Promise<NextResponse> {
  return protectedRoute(request, handler, { mutation });
}

export function expectedTaskRevision(body: Record<string, unknown>): number | undefined {
  const value = body.expectedRevision;
  if (value === undefined) return undefined;
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
    throw new AppError("INVALID_REQUEST");
  }
  return value;
}

export { getDatabase, parseJsonObject, parseOptionalJsonObject };
