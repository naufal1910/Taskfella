import { timingSafeEqual } from "node:crypto";
import { type AppEnv, getEnvironment } from "@/server/config/env";
import { AppError } from "@/server/http/errors";
import { CSRF_HEADER_NAME, getCsrfCookie } from "./cookies";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

export function isCsrfProtectedMethod(method: string): boolean {
  return !SAFE_METHODS.has(method.toUpperCase());
}

function sameOrigin(value: string | null, expectedOrigin: string): boolean {
  if (!value || value === "null") {
    return false;
  }

  try {
    return new URL(value).origin === new URL(expectedOrigin).origin;
  } catch {
    return false;
  }
}

function safeTokenEquals(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left, "utf8");
  const rightBuffer = Buffer.from(right, "utf8");
  return (
    leftBuffer.length > 0 &&
    leftBuffer.length === rightBuffer.length &&
    timingSafeEqual(leftBuffer, rightBuffer)
  );
}

/**
 * Enforce both browser origin and double-submit token checks for cookie-backed
 * mutations. Missing origin information is rejected rather than treated as
 * same-origin, which keeps a cross-site form from reaching a mutation route.
 */
export function validateCsrfRequest(
  request: Request,
  options: { environment?: AppEnv; expectedOrigin?: string } = {},
): void {
  if (!isCsrfProtectedMethod(request.method)) {
    return;
  }

  const expectedOrigin =
    options.expectedOrigin ?? options.environment?.APP_URL ?? getEnvironment().APP_URL;
  const origin = request.headers.get("origin");
  const referer = request.headers.get("referer");
  const originIsValid = sameOrigin(origin, expectedOrigin);
  const refererIsValid = sameOrigin(referer, expectedOrigin);

  if (!originIsValid && !(!origin && refererIsValid)) {
    throw new AppError("FORBIDDEN");
  }

  const cookieToken = getCsrfCookie(request);
  const headerToken = request.headers.get(CSRF_HEADER_NAME);
  if (!cookieToken || !headerToken || !safeTokenEquals(cookieToken, headerToken)) {
    throw new AppError("FORBIDDEN");
  }
}
