import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { proxy } from "@/proxy";

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

  it("keeps the settings API non-cacheable", () => {
    const response = proxy(new NextRequest("https://taskfella.example/api/account/settings"));

    expect(response.headers.get("cache-control")).toBe("no-store");
  });
});
