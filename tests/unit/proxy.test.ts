import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { proxy } from "@/proxy";

function withProxyEnvironment<T>(
  appUrl: string | undefined,
  databaseUrl: string | undefined,
  callback: () => T,
): T {
  const previousAppUrl = process.env.APP_URL;
  const previousDatabaseUrl = process.env.DATABASE_URL;
  if (appUrl === undefined) delete process.env.APP_URL;
  else process.env.APP_URL = appUrl;
  if (databaseUrl === undefined) delete process.env.DATABASE_URL;
  else process.env.DATABASE_URL = databaseUrl;

  try {
    return callback();
  } finally {
    if (previousAppUrl === undefined) delete process.env.APP_URL;
    else process.env.APP_URL = previousAppUrl;
    if (previousDatabaseUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = previousDatabaseUrl;
  }
}

describe("authentication and settings page headers", () => {
  it.each([
    "/verify-email",
    "/verify-email/",
    "/reset-password",
    "/reset-password/",
    "/account",
    "/account/",
    "/settings",
    "/settings/",
  ])("keeps sensitive pages non-cacheable for %s", (pathname) => {
    const response = proxy(
      new NextRequest(`https://taskfella.example${pathname}?token=one-time-token`),
    );

    expect(response.headers.get("cache-control")).toBe("no-store");
    if (pathname.startsWith("/verify-email") || pathname.startsWith("/reset-password")) {
      expect(response.headers.get("referrer-policy")).toBe("no-referrer");
    }
  });

  it("canonicalizes legacy one-time query links to the configured application origin", async () => {
    const response = withProxyEnvironment("https://taskfella.example", undefined, () =>
      proxy(new NextRequest("http://untrusted.example/verify-email?token=one-time-token")),
    );

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe(
      "https://taskfella.example/verify-email#token=one-time-token",
    );
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("referrer-policy")).toBe("no-referrer");
    await expect(response.text()).resolves.toBe("");
  });

  it("keeps header behavior available without complete runtime configuration", () => {
    const response = withProxyEnvironment(undefined, undefined, () =>
      proxy(new NextRequest("https://untrusted.example/verify-email?token=one-time-token")),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("referrer-policy")).toBe("no-referrer");
  });

  it("keeps the settings API non-cacheable", () => {
    const response = proxy(new NextRequest("https://taskfella.example/api/account/settings"));

    expect(response.headers.get("cache-control")).toBe("no-store");
  });
});
