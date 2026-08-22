import { describe, expect, it } from "vitest";
import { AppError } from "@/server/http/errors";
import { clientSubject, LOCAL_PROXY_MARKER } from "@/server/http/auth-route";

const developmentEnvironment = {
  NODE_ENV: "development" as const,
  DATABASE_URL: "postgresql://taskfella:taskfella@localhost:5433/taskfella",
  APP_URL: "http://localhost:3000",
  LOG_LEVEL: "info" as const,
  DB_POOL_MAX: 10,
  AUTH_TRUSTED_PROXY: false,
};

describe("local proxy rate-limit boundary", () => {
  it("uses one safe local bucket for forwarding metadata added by Next", () => {
    const request = new Request("http://localhost:3000/api/auth/signup", {
      headers: {
        [LOCAL_PROXY_MARKER]: "1",
        "x-forwarded-for": "127.0.0.1",
      },
    });

    expect(clientSubject(request, developmentEnvironment)).toBe("local-client");
  });

  it("still rejects untrusted forwarding metadata without the local marker", () => {
    const request = new Request("http://localhost:3000/api/auth/signup", {
      headers: { "x-forwarded-for": "203.0.113.10" },
    });

    expect(() => clientSubject(request, developmentEnvironment)).toThrow(AppError);
  });
});
