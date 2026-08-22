import { NextResponse } from "next/server";
import { isIP } from "node:net";
import { type AppEnv, getEnvironment } from "@/server/config/env";
import { type Database, getDatabase } from "@/server/db/client";
import { AppError, appErrorResponse, toAppError } from "@/server/http/errors";
import { applyRequestContext, getRequestContext } from "@/server/http/request-id";
import { logger } from "@/server/observability/logger";
import { LOCAL_PROXY_MARKER } from "./proxy-marker";
import { validateCsrfRequest } from "@/server/modules/auth/csrf";
import { AUTH_RATE_LIMITS, consumeRateLimit } from "@/server/modules/auth/rate-limit";

export { LOCAL_PROXY_MARKER } from "./proxy-marker";

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

async function parseJsonObjectBody(
  request: Request,
  allowEmpty: boolean,
): Promise<Record<string, unknown>> {
  let text: string;
  try {
    text = await request.text();
  } catch {
    throw new AppError("INVALID_REQUEST");
  }

  if (text.trim().length === 0) {
    if (allowEmpty) return {};
    throw new AppError("INVALID_REQUEST");
  }

  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    throw new AppError("INVALID_REQUEST");
  }

  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new AppError("INVALID_REQUEST");
  }

  return value as Record<string, unknown>;
}

export function parseJsonObject(request: Request): Promise<Record<string, unknown>> {
  return parseJsonObjectBody(request, false);
}

export function parseOptionalJsonObject(request: Request): Promise<Record<string, unknown>> {
  return parseJsonObjectBody(request, true);
}

export function clientSubject(request: Request, environment: AppEnv): string {
  const forwarded = request.headers.get("x-forwarded-for");
  const real = request.headers.get("x-real-ip");
  const hasForwardingHeaders = forwarded !== null || real !== null;

  // Next's own development proxy adds forwarding metadata before a route
  // handler runs. Marking that hop in proxy.ts preserves the documented local
  // configuration without trusting a client-supplied forwarding address.
  if (
    environment.NODE_ENV !== "production" &&
    environment.AUTH_TRUSTED_PROXY !== true &&
    request.headers.get(LOCAL_PROXY_MARKER) === "1"
  ) {
    return "local-client";
  }

  if (environment.AUTH_TRUSTED_PROXY !== true) {
    if (hasForwardingHeaders || environment.NODE_ENV === "production") {
      throw new AppError("FORBIDDEN");
    }
    return "local-client";
  }

  const subject = real?.trim() || forwarded?.split(",", 1)[0]?.trim() || "";
  if (subject.length === 0 || subject.length > 128 || isIP(subject) === 0) {
    throw new AppError("FORBIDDEN");
  }

  return subject;
}

/** Consume both a client and, when available, an identity bucket. */
export async function enforceAuthRateLimits(
  request: Request,
  db: Database,
  operation: keyof typeof AUTH_RATE_LIMITS,
  identity?: string,
  options: { environment?: AppEnv } = {},
): Promise<void> {
  const policy = AUTH_RATE_LIMITS[operation];
  const environment = options.environment ?? getEnvironment();
  const client = await consumeRateLimit(
    db,
    { operation: `auth:${operation}:client`, subject: clientSubject(request, environment) },
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
