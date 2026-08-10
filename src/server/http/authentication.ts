import { NextResponse } from "next/server";
import { type AppEnv, getEnvironment } from "@/server/config/env";
import { getDatabase, type Database } from "@/server/db/client";
import { type Account } from "@/server/db/schema";
import { logger } from "@/server/observability/logger";
import { getSessionToken } from "@/server/modules/auth/cookies";
import { validateCsrfRequest } from "@/server/modules/auth/csrf";
import { lookupSession, type AuthenticatedSession } from "@/server/modules/auth/sessions";
import { getAccountById } from "@/server/modules/auth/accounts";
import { appErrorResponse, AppError } from "./errors";
import { applyRequestContext, getRequestContext } from "./request-id";

export interface AuthenticatedAccount {
  account: Account;
  session: AuthenticatedSession;
}

export interface AuthenticationDependencies {
  db?: Database;
}

export async function resolveAuthenticatedAccount(
  request: Request,
  dependencies: AuthenticationDependencies = {},
): Promise<AuthenticatedAccount | null> {
  const token = getSessionToken(request);
  if (!token) {
    return null;
  }

  const db = dependencies.db ?? getDatabase();
  const session = await lookupSession(db, token);
  if (!session) {
    return null;
  }

  const account = await getAccountById(db, session.accountId);
  if (!account) {
    return null;
  }

  return { account, session };
}

export async function requireAuthenticatedAccount(
  request: Request,
  dependencies: AuthenticationDependencies = {},
): Promise<AuthenticatedAccount> {
  const authenticated = await resolveAuthenticatedAccount(request, dependencies);
  if (!authenticated) {
    throw new AppError("UNAUTHORIZED");
  }

  return authenticated;
}

export interface ProtectedRouteOptions extends AuthenticationDependencies {
  mutation?: boolean;
  environment?: AppEnv;
}

/**
 * Reusable App Router boundary for server-authenticated APIs. Route handlers
 * receive the account resolved from the opaque session, never a client account
 * identifier. Mutation routes opt into CSRF validation at this boundary.
 */
export async function protectedRoute(
  request: Request,
  handler: (authenticated: AuthenticatedAccount) => Promise<NextResponse>,
  options: ProtectedRouteOptions = {},
): Promise<NextResponse> {
  const context = getRequestContext(request);

  try {
    const authenticated = await requireAuthenticatedAccount(request, options);
    if (options.mutation) {
      validateCsrfRequest(request, {
        environment: options.environment ?? getEnvironment(),
      });
    }

    const response = await handler(authenticated);
    applyRequestContext(response.headers, context);
    return response;
  } catch (error) {
    const appError = error instanceof AppError ? error : new AppError("INTERNAL_ERROR");
    logger.warn("protected_route_rejected", {
      requestId: context.requestId,
      correlationId: context.correlationId,
      method: request.method,
      path: new URL(request.url).pathname,
      status: appError.status,
      errorCode: appError.code,
      component: "authentication",
    });

    const response = appErrorResponse(appError, context.requestId);
    applyRequestContext(response.headers, context);
    return response;
  }
}
