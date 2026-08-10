import { describe, expect, it } from "vitest";
import { healthRoute } from "@/app/api/health/route";

describe("application startup smoke", () => {
  it("exposes a successful foundation health response without product state", async () => {
    const response = await healthRoute(
      new Request("http://localhost/api/health", {
        headers: {
          "x-request-id": "smoke-request",
          "x-correlation-id": "smoke-trace",
        },
      }),
      { checkDatabase: async () => true },
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("x-request-id")).toBe("smoke-request");
    expect(response.headers.get("x-correlation-id")).toBe("smoke-trace");
    await expect(response.json()).resolves.toMatchObject({
      status: "ok",
      application: "ok",
      database: "ready",
      requestId: "smoke-request",
      correlationId: "smoke-trace",
    });
  });
});
