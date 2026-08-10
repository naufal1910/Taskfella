import { describe, expect, it } from "vitest";
import { NextResponse } from "next/server";
import {
  CSRF_COOKIE_NAME,
  CSRF_HEADER_NAME,
  ensureCsrfCookie,
  setSessionCookie,
} from "@/server/modules/auth/cookies";
import { validateCsrfRequest } from "@/server/modules/auth/csrf";

const developmentEnvironment = {
  NODE_ENV: "development" as const,
  DATABASE_URL: "postgresql://taskfella:taskfella@localhost:5432/taskfella",
  APP_URL: "http://localhost:3000",
  LOG_LEVEL: "info" as const,
  DB_POOL_MAX: 10,
};

const productionEnvironment = { ...developmentEnvironment, NODE_ENV: "production" as const };

describe("cookie-authenticated mutation protection", () => {
  it("uses same-origin validation and a matching double-submit token", () => {
    const response = NextResponse.next();
    const token = ensureCsrfCookie(
      new Request("http://localhost:3000/api/csrf"),
      response,
      developmentEnvironment,
    );

    const request = new Request("http://localhost:3000/api/account", {
      method: "POST",
      headers: {
        origin: "http://localhost:3000",
        cookie: `${CSRF_COOKIE_NAME}=${token}`,
        [CSRF_HEADER_NAME]: token,
      },
    });

    expect(() =>
      validateCsrfRequest(request, { expectedOrigin: "http://localhost:3000" }),
    ).not.toThrow();
    expect(response.cookies.get(CSRF_COOKIE_NAME)?.value).toBe(token);
  });

  it("rejects missing/cross-site origins and mismatched tokens", () => {
    const cases = [
      new Request("http://localhost:3000/api/account", {
        method: "POST",
        headers: { cookie: `${CSRF_COOKIE_NAME}=token`, [CSRF_HEADER_NAME]: "token" },
      }),
      new Request("http://localhost:3000/api/account", {
        method: "POST",
        headers: {
          origin: "https://evil.example",
          cookie: `${CSRF_COOKIE_NAME}=token`,
          [CSRF_HEADER_NAME]: "token",
        },
      }),
      new Request("http://localhost:3000/api/account", {
        method: "POST",
        headers: {
          origin: "http://localhost:3000",
          cookie: `${CSRF_COOKIE_NAME}=token`,
          [CSRF_HEADER_NAME]: "different",
        },
      }),
    ];

    for (const request of cases) {
      expect(() =>
        validateCsrfRequest(request, { expectedOrigin: "http://localhost:3000" }),
      ).toThrow("The request is not allowed.");
    }
  });

  it("allows safe reads and marks the session cookie HttpOnly, with Secure only in production", () => {
    expect(() =>
      validateCsrfRequest(new Request("http://localhost:3000/api/account"), {
        expectedOrigin: "http://localhost:3000",
      }),
    ).not.toThrow();

    const developmentResponse = NextResponse.next();
    setSessionCookie(developmentResponse, "opaque-token", undefined, developmentEnvironment);
    expect(developmentResponse.cookies.get("taskfella_session")?.httpOnly).toBe(true);
    expect(developmentResponse.cookies.get("taskfella_session")?.secure).toBe(false);

    const productionResponse = NextResponse.next();
    setSessionCookie(productionResponse, "opaque-token", undefined, productionEnvironment);
    expect(productionResponse.cookies.get("taskfella_session")?.httpOnly).toBe(true);
    expect(productionResponse.cookies.get("taskfella_session")?.secure).toBe(true);
  });
});
