import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { proxy } from "@/proxy";

describe("authentication token page headers", () => {
  it.each(["/verify-email", "/verify-email/", "/reset-password", "/reset-password/"])(
    "blocks referrers from carrying token page URLs for %s",
    (pathname) => {
      const response = proxy(
        new NextRequest(`https://taskfella.example${pathname}?token=one-time-token`),
      );

      expect(response.headers.get("cache-control")).toBe("no-store");
      expect(response.headers.get("referrer-policy")).toBe("no-referrer");
    },
  );
});
