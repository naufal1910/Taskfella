import { NextResponse } from "next/server";
import { type AppEnv, getEnvironment } from "@/server/config/env";
import { type Database } from "@/server/db/client";
import { AppError } from "@/server/http/errors";
import { enforceAuthRateLimits } from "@/server/http/auth-route";
import {
  clearOAuthCookies,
  getOAuthCodeVerifierCookie,
  getOAuthStateCookie,
  getSessionToken,
  setOAuthCookies,
  setSessionCookie,
} from "./cookies";
import { validateCsrfRequest } from "./csrf";
import { completeGoogleIdentity } from "./identities";
import {
  createGoogleCodeChallenge,
  createGoogleOAuthClient,
  getGoogleOAuthConfig,
  type GoogleOAuthClient,
} from "./google";
import {
  consumeOAuthTransaction,
  createOAuthTransaction,
  GOOGLE_PROVIDER,
  type OAuthIntent,
} from "./oauth-state";
import { resolveAuthenticatedAccount } from "@/server/http/authentication";
import { hashBearerToken, safeHashEquals } from "./tokens";

export interface OAuthFlowOptions {
  db: Database;
  environment?: AppEnv;
  provider?: GoogleOAuthClient;
  now?: Date;
  responseMode?: "redirect" | "json";
}

function getIntent(request: Request): OAuthIntent {
  const url = new URL(request.url);
  const raw = url.searchParams.get("intent") ?? url.searchParams.get("mode");
  if (raw === null || raw === "signin") {
    return "signin";
  }
  if (raw === "link" || url.searchParams.get("link") === "true") {
    return "link";
  }
  throw new AppError("INVALID_REQUEST");
}

function addNoStoreHeaders(response: NextResponse): NextResponse {
  response.headers.set("cache-control", "no-store");
  response.headers.set("referrer-policy", "no-referrer");
  return response;
}

function redirectWithStatus(
  environment: AppEnv,
  pathname: "/login" | "/account",
  status: string,
): NextResponse {
  const destination = new URL(pathname, environment.APP_URL);
  destination.searchParams.set("oauth", status);
  return addNoStoreHeaders(NextResponse.redirect(destination, 303));
}

function clearAndRedirect(
  environment: AppEnv,
  pathname: "/login" | "/account",
  status: string,
): NextResponse {
  const response = redirectWithStatus(environment, pathname, status);
  clearOAuthCookies(response, environment);
  return response;
}

async function rateLimitOAuthFailure(
  request: Request,
  db: Database,
  environment: AppEnv,
): Promise<"rate-limited" | "allowed"> {
  try {
    await enforceAuthRateLimits(request, db, "oauthFailure", undefined, { environment });
    return "allowed";
  } catch (error) {
    if (error instanceof AppError && error.code === "RATE_LIMITED") {
      return "rate-limited";
    }
    return "allowed";
  }
}

export async function startGoogleAuthorization(
  request: Request,
  options: OAuthFlowOptions,
): Promise<NextResponse> {
  const environment = options.environment ?? getEnvironment();
  const config = getGoogleOAuthConfig(environment);
  if (!config) {
    throw new AppError("OAUTH_NOT_CONFIGURED");
  }

  const intent = getIntent(request);
  if (intent === "link") {
    if (request.method !== "POST") {
      throw new AppError("FORBIDDEN");
    }
    validateCsrfRequest(request, { environment });
  }
  await enforceAuthRateLimits(request, options.db, "oauthStart", undefined, { environment });
  let accountId: string | undefined;
  let sessionId: string | undefined;
  if (intent === "link") {
    const authenticated = await resolveAuthenticatedAccount(request, { db: options.db });
    if (!authenticated) {
      throw new AppError("UNAUTHORIZED");
    }
    accountId = authenticated.account.id;
    sessionId = authenticated.session.id;
  }

  const ceremony = await createOAuthTransaction(options.db, {
    provider: GOOGLE_PROVIDER,
    intent,
    accountId,
    sessionId,
    now: options.now,
  });
  const provider = options.provider ?? createGoogleOAuthClient(config);
  const authorizationUrl = provider.getAuthorizationUrl({
    state: ceremony.state,
    codeChallenge: createGoogleCodeChallenge(ceremony.codeVerifier),
  });
  const response =
    options.responseMode === "json"
      ? addNoStoreHeaders(NextResponse.json({ authorizationUrl }))
      : addNoStoreHeaders(NextResponse.redirect(authorizationUrl, 302));
  setOAuthCookies(response, ceremony.state, ceremony.codeVerifier, environment);
  return response;
}

function callbackStateMatches(queryState: string, cookieState: string): boolean {
  try {
    return safeHashEquals(hashBearerToken(queryState), hashBearerToken(cookieState));
  } catch {
    return false;
  }
}

export async function handleGoogleCallback(
  request: Request,
  options: OAuthFlowOptions,
): Promise<NextResponse> {
  const environment = options.environment ?? getEnvironment();
  let config: ReturnType<typeof getGoogleOAuthConfig>;
  try {
    config = getGoogleOAuthConfig(environment);
  } catch {
    return clearAndRedirect(environment, "/login", "not-configured");
  }
  if (!config) {
    return clearAndRedirect(environment, "/login", "not-configured");
  }

  const url = new URL(request.url);
  const queryState = url.searchParams.get("state") ?? "";
  const cookieState = getOAuthStateCookie(request);
  const codeVerifier = getOAuthCodeVerifierCookie(request);
  if (!cookieState || !codeVerifier || !callbackStateMatches(queryState, cookieState)) {
    const limited = await rateLimitOAuthFailure(request, options.db, environment);
    return clearAndRedirect(
      environment,
      "/login",
      limited === "rate-limited" ? "rate-limited" : "state-invalid",
    );
  }

  let transaction: Awaited<ReturnType<typeof consumeOAuthTransaction>>;
  try {
    transaction = await consumeOAuthTransaction(options.db, {
      provider: GOOGLE_PROVIDER,
      state: queryState,
      codeVerifier,
      now: options.now,
    });
  } catch {
    return clearAndRedirect(environment, "/login", "provider-error");
  }
  if (!transaction) {
    const limited = await rateLimitOAuthFailure(request, options.db, environment);
    return clearAndRedirect(
      environment,
      "/login",
      limited === "rate-limited" ? "rate-limited" : "state-invalid",
    );
  }

  const providerError = url.searchParams.get("error");
  if (providerError) {
    const limited = await rateLimitOAuthFailure(request, options.db, environment);
    return clearAndRedirect(
      environment,
      transaction.transaction.intent === "link" ? "/account" : "/login",
      limited === "rate-limited"
        ? "rate-limited"
        : providerError === "access_denied"
          ? "cancelled"
          : "provider-error",
    );
  }

  const code = url.searchParams.get("code");
  if (!code || code.length > 2048) {
    const limited = await rateLimitOAuthFailure(request, options.db, environment);
    return clearAndRedirect(
      environment,
      transaction.transaction.intent === "link" ? "/account" : "/login",
      limited === "rate-limited" ? "rate-limited" : "state-invalid",
    );
  }

  try {
    const provider = options.provider ?? createGoogleOAuthClient(config);
    const profile = await provider.fetchIdentity(code, transaction.codeVerifier);
    const result = await completeGoogleIdentity(options.db, {
      transaction: transaction.transaction,
      profile,
      presentedToken: getSessionToken(request),
      now: options.now,
    });

    if (result.state === "authenticated" || result.state === "created") {
      const response = clearAndRedirect(environment, "/account", "success");
      setSessionCookie(
        response,
        result.session.token,
        result.session.session.expiresAt,
        environment,
      );
      return response;
    }
    if (result.state === "linked") {
      const response = clearAndRedirect(environment, "/account", "linked");
      setSessionCookie(
        response,
        result.session.token,
        result.session.session.expiresAt,
        environment,
      );
      return response;
    }
    if (result.state === "already-linked") {
      const response = clearAndRedirect(environment, "/account", "already-linked");
      setSessionCookie(
        response,
        result.session.token,
        result.session.session.expiresAt,
        environment,
      );
      return response;
    }
    if (result.state === "link-required") {
      return clearAndRedirect(environment, "/login", "provider-error");
    }
    if (result.state === "identity-conflict") {
      return clearAndRedirect(
        environment,
        transaction.transaction.intent === "link" ? "/account" : "/login",
        "conflict",
      );
    }
    if (result.state === "email-conflict") {
      return clearAndRedirect(
        environment,
        transaction.transaction.intent === "link" ? "/account" : "/login",
        "email-conflict",
      );
    }
    return clearAndRedirect(environment, "/login", "session-expired");
  } catch {
    const limited = await rateLimitOAuthFailure(request, options.db, environment);
    return clearAndRedirect(
      environment,
      transaction.transaction.intent === "link" ? "/account" : "/login",
      limited === "rate-limited" ? "rate-limited" : "provider-error",
    );
  }
}
