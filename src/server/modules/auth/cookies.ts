import { randomBytes } from "node:crypto";
import type { NextResponse } from "next/server";
import { type AppEnv, getEnvironment } from "@/server/config/env";
import { APPEARANCE_VALUES, type Appearance } from "@/server/modules/account/settings";

export const SESSION_COOKIE_NAME = "taskfella_session";
export const CSRF_COOKIE_NAME = "taskfella_csrf";
export const APPEARANCE_COOKIE_NAME = "taskfella_appearance";
export const APPEARANCE_REVISION_COOKIE_NAME = "taskfella_appearance_revision";
export const APPEARANCE_IDENTITY_COOKIE_NAME = "taskfella_appearance_identity";
export const CSRF_HEADER_NAME = "x-csrf-token";
export const SESSION_COOKIE_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;
export const CSRF_COOKIE_MAX_AGE_SECONDS = 24 * 60 * 60;
export const APPEARANCE_COOKIE_MAX_AGE_SECONDS = 365 * 24 * 60 * 60;
export const OAUTH_STATE_COOKIE_NAME = "taskfella_oauth_state";
export const OAUTH_VERIFIER_COOKIE_NAME = "taskfella_oauth_verifier";
export const OAUTH_COOKIE_MAX_AGE_SECONDS = 10 * 60;

function readCookie(request: Request, name: string): string | undefined {
  const cookieHeader = request.headers.get("cookie");
  if (!cookieHeader) {
    return undefined;
  }

  for (const part of cookieHeader.split(";")) {
    const separator = part.indexOf("=");
    if (separator < 0) {
      continue;
    }

    const key = part.slice(0, separator).trim();
    if (key !== name) {
      continue;
    }

    const value = part.slice(separator + 1).trim();
    try {
      const decoded = decodeURIComponent(value);
      return decoded.length > 0 && decoded.length <= 512 ? decoded : undefined;
    } catch {
      return undefined;
    }
  }

  return undefined;
}

export function getSessionToken(request: Request): string | undefined {
  return readCookie(request, SESSION_COOKIE_NAME);
}

export function getCsrfCookie(request: Request): string | undefined {
  return readCookie(request, CSRF_COOKIE_NAME);
}

export function getAppearanceCookie(request: Request): Appearance | undefined {
  const value = readCookie(request, APPEARANCE_COOKIE_NAME);
  return value && APPEARANCE_VALUES.includes(value as Appearance)
    ? (value as Appearance)
    : undefined;
}

export function getAppearanceRevisionCookie(request: Request): string | undefined {
  return readCookie(request, APPEARANCE_REVISION_COOKIE_NAME);
}

export function getOAuthStateCookie(request: Request): string | undefined {
  return readCookie(request, OAUTH_STATE_COOKIE_NAME);
}

export function getOAuthCodeVerifierCookie(request: Request): string | undefined {
  return readCookie(request, OAUTH_VERIFIER_COOKIE_NAME);
}

function isProduction(environment: AppEnv): boolean {
  return environment.NODE_ENV === "production";
}

function setCookie(
  response: NextResponse,
  name: string,
  value: string,
  options: {
    maxAge: number;
    httpOnly: boolean;
    secure: boolean;
  },
): void {
  response.cookies.set({
    name,
    value,
    path: "/",
    maxAge: options.maxAge,
    httpOnly: options.httpOnly,
    secure: options.secure,
    sameSite: "lax",
  });
}

export function setSessionCookie(
  response: NextResponse,
  token: string,
  expiresAt?: Date,
  environment: AppEnv = getEnvironment(),
): void {
  const maxAge = expiresAt
    ? Math.max(
        1,
        Math.min(
          SESSION_COOKIE_MAX_AGE_SECONDS,
          Math.ceil((expiresAt.getTime() - Date.now()) / 1000),
        ),
      )
    : SESSION_COOKIE_MAX_AGE_SECONDS;
  setCookie(response, SESSION_COOKIE_NAME, token, {
    maxAge,
    httpOnly: true,
    secure: isProduction(environment),
  });
}

export function clearSessionCookie(
  response: NextResponse,
  environment: AppEnv = getEnvironment(),
): void {
  setCookie(response, SESSION_COOKIE_NAME, "", {
    maxAge: 0,
    httpOnly: true,
    secure: isProduction(environment),
  });
}

/** A non-sensitive cache of the account preference used for pre-paint theme selection. */
function appearanceCookieIsSecure(environment?: AppEnv): boolean {
  return environment ? isProduction(environment) : process.env.NODE_ENV === "production";
}

export function setAppearanceCookie(
  response: NextResponse,
  appearance: Appearance,
  environment?: AppEnv,
  revision?: string,
  identity?: string,
): void {
  setCookie(response, APPEARANCE_COOKIE_NAME, appearance, {
    maxAge: APPEARANCE_COOKIE_MAX_AGE_SECONDS,
    httpOnly: false,
    secure: appearanceCookieIsSecure(environment),
  });
  if (revision) {
    setCookie(response, APPEARANCE_REVISION_COOKIE_NAME, revision, {
      maxAge: APPEARANCE_COOKIE_MAX_AGE_SECONDS,
      httpOnly: false,
      secure: appearanceCookieIsSecure(environment),
    });
  }
  if (identity) {
    setCookie(response, APPEARANCE_IDENTITY_COOKIE_NAME, identity, {
      maxAge: APPEARANCE_COOKIE_MAX_AGE_SECONDS,
      httpOnly: false,
      secure: appearanceCookieIsSecure(environment),
    });
  }
}

export function clearAppearanceCookie(response: NextResponse, environment?: AppEnv): void {
  setCookie(response, APPEARANCE_COOKIE_NAME, "", {
    maxAge: 0,
    httpOnly: false,
    secure: appearanceCookieIsSecure(environment),
  });
  setCookie(response, APPEARANCE_REVISION_COOKIE_NAME, "", {
    maxAge: 0,
    httpOnly: false,
    secure: appearanceCookieIsSecure(environment),
  });
  setCookie(response, APPEARANCE_IDENTITY_COOKIE_NAME, "", {
    maxAge: 0,
    httpOnly: false,
    secure: appearanceCookieIsSecure(environment),
  });
}

export function createCsrfToken(): string {
  return randomBytes(32).toString("base64url");
}

/** Set a readable double-submit token; the authentication cookie remains HttpOnly. */
export function setCsrfCookie(
  response: NextResponse,
  token: string,
  environment: AppEnv = getEnvironment(),
): void {
  setCookie(response, CSRF_COOKIE_NAME, token, {
    maxAge: CSRF_COOKIE_MAX_AGE_SECONDS,
    httpOnly: false,
    secure: isProduction(environment),
  });
}

export function ensureCsrfCookie(
  request: Request,
  response: NextResponse,
  environment: AppEnv = getEnvironment(),
): string {
  const existing = getCsrfCookie(request);
  if (existing) {
    return existing;
  }

  const token = createCsrfToken();
  setCsrfCookie(response, token, environment);
  return token;
}

/** Store only short-lived OAuth ceremony material in HttpOnly, Lax cookies. */
export function setOAuthCookies(
  response: NextResponse,
  state: string,
  codeVerifier: string,
  environment: AppEnv = getEnvironment(),
): void {
  setCookie(response, OAUTH_STATE_COOKIE_NAME, state, {
    maxAge: OAUTH_COOKIE_MAX_AGE_SECONDS,
    httpOnly: true,
    secure: isProduction(environment),
  });
  setCookie(response, OAUTH_VERIFIER_COOKIE_NAME, codeVerifier, {
    maxAge: OAUTH_COOKIE_MAX_AGE_SECONDS,
    httpOnly: true,
    secure: isProduction(environment),
  });
}

export function clearOAuthCookies(
  response: NextResponse,
  environment: AppEnv = getEnvironment(),
): void {
  setCookie(response, OAUTH_STATE_COOKIE_NAME, "", {
    maxAge: 0,
    httpOnly: true,
    secure: isProduction(environment),
  });
  setCookie(response, OAUTH_VERIFIER_COOKIE_NAME, "", {
    maxAge: 0,
    httpOnly: true,
    secure: isProduction(environment),
  });
}
