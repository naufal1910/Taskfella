import { NextResponse } from "next/server";
import { checkDatabaseReadiness } from "@/server/db/client";
import { evaluateHealth, type DatabaseReadinessCheck } from "@/server/health";
import { applyRequestContext, getRequestContext } from "@/server/http/request-id";
import { logger } from "@/server/observability/logger";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function healthRoute(
  request: Request,
  dependencies: { checkDatabase: DatabaseReadinessCheck } = {
    checkDatabase: checkDatabaseReadiness,
  },
): Promise<NextResponse> {
  const context = getRequestContext(request);
  const startedAt = performance.now();
  const health = await evaluateHealth(
    context.requestId,
    context.correlationId,
    dependencies.checkDatabase,
  );
  const durationMs = Math.round(performance.now() - startedAt);

  logger.info(health.status === "ok" ? "health_check_succeeded" : "health_check_not_ready", {
    requestId: context.requestId,
    correlationId: context.correlationId,
    method: request.method,
    path: new URL(request.url).pathname,
    status: health.httpStatus,
    durationMs,
    component: "health",
  });

  const response = NextResponse.json(health, {
    status: health.httpStatus,
    headers: { "cache-control": "no-store" },
  });
  applyRequestContext(response.headers, context);
  return response;
}

export async function GET(request: Request): Promise<NextResponse> {
  return healthRoute(request);
}
