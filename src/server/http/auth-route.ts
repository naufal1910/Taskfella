import { NextResponse } from "next/server";
import { type AppEnv, getEnvironment } from "@/server/config/env";
import { type Database, getDatabase } from "@/server/db/client";
import { AppError, appErrorResponse, toAppError } from "@/server/http/errors";
import { applyRequestContext, getRequestContext } from "@/server/http/request-id";
import { logger } from "@/server/observability/logger";
import { validateCsrfRequest } from "@/server/modules/auth/csrf";
import { AUTH_RATE_LIMITS, consumeRateLimit } from "@/server/modules/auth/rate-limit";

export interface AuthRouteOptions {
  db?: Database;
  environment?: AppEnv;
}

export interface AuthRouteContext extends AuthRouteOptions {
  requestId: string;
  correlationId: string;
}

export function noStoreResponse(
  body: unknown,
  status = 200,
  context?: { requestId?: string; correlationId?: string },
): NextResponse {
  const response = NextResponse.json(body, {
    status,
    headers: { "cache-control": "no-store" },
  });
  if (context?.requestId) {
    response.headers.set("x-request-id", context.requestId);
  }
  if (context?.correlationId) {
    response.headers.set("x-correlation-id", context.correlationId);
  }
  return response;
}

export async function authRoute(
  request: Request,
  handler: (context: AuthRouteContext) => Promise<NextResponse>,
  options: AuthRouteOptions = {},
): Promise<NextResponse> {
  const requestContext = getRequestContext(request);
  const context: AuthRouteContext = {
    ...options,
    requestId: requestContext.requestId,
    correlationId: requestContext.correlationId,
  };

  try {
    const response = await handler(context);
    applyRequestContext(response.headers, requestContext);
    response.headers.set("cache-control", "no-store");
    return response;
  } catch (error) {
    const appError = toAppError(error);
    logger.warn("auth_route_rejected", {
      requestId: requestContext.requestId,
      correlationId: requestContext.correlationId,
      method: request.method,
      path: new URL(request.url).pathname,
      status: appError.status,
      errorCode: appError.code,
      component: "authentication",
    });
    const response = appErrorResponse(appError, requestContext.requestId);
    applyRequestContext(response.headers, requestContext);
    response.headers.set("cache-control", "no-store");
    return response;
  }
}

export function databaseFor(context: AuthRouteContext): Database {
  return context.db ?? getDatabase();
}

export function requireAuthCsrf(request: Request, context: AuthRouteContext): void {
  validateCsrfRequest(request, {
    environment: context.environment ?? getEnvironment(),
  });
}

export async function parseJsonObject(request: Request): Promise<Record<string, unknown>> {
  let value: unknown;
  try {
    value = await request.json();
  } catch {
    throw new AppError("INVALID_REQUEST");
  }

  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new AppError("INVALID_REQUEST");
  }

  return value as Record<string, unknown>;
}

function clientSubject(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",", 1)[0]?.trim();
  const direct = request.headers.get("x-real-ip")?.trim();
  const value = forwarded || direct;
  return value && value.length <= 128 ? value : "anonymous-client";
}

/** Consume both a client and, when available, an identity bucket. */
export async function enforceAuthRateLimits(
  request: Request,
  db: Database,
  operation: keyof typeof AUTH_RATE_LIMITS,
  identity?: string,
): Promise<void> {
  const policy = AUTH_RATE_LIMITS[operation];
  const client = await consumeRateLimit(
    db,
    { operation: `auth:${operation}:client`, subject: clientSubject(request) },
    policy,
  );
  if (!client.allowed) {
    throw new AppError("RATE_LIMITED", undefined, {
      retryAfterSeconds: client.retryAfterSeconds,
    });
  }

  if (identity) {
    const accountBucket = await consumeRateLimit(
      db,
      { operation: `auth:${operation}:identity`, subject: identity },
      policy,
    );
    if (!accountBucket.allowed) {
      throw new AppError("RATE_LIMITED", undefined, {
        retryAfterSeconds: accountBucket.retryAfterSeconds,
      });
    }
  }
}

export function invalidInput(): never {
  throw new AppError("INVALID_REQUEST");
}

export function tokenStateError(
  state: "invalid" | "expired" | "already-used" | "superseded",
): never {
  const code =
    state === "invalid"
      ? "TOKEN_INVALID"
      : state === "expired"
        ? "TOKEN_EXPIRED"
        : state === "already-used"
          ? "TOKEN_ALREADY_USED"
          : "TOKEN_SUPERSEDED";
  throw new AppError(code);
}
