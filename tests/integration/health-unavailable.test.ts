import { describe, expect, it } from "vitest";
import { healthRoute } from "@/app/api/health/route";

describe("database unavailable health behavior", () => {
  it("returns HTTP 503 and no internal details", async () => {
    const response = await healthRoute(new Request("http://localhost/api/health"), {
      checkDatabase: async () => {
        throw new Error("connection string and password are private");
      },
    });
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body).toMatchObject({
      status: "degraded",
      application: "ok",
      database: "unavailable",
    });
    expect(JSON.stringify(body)).not.toContain("connection string");
    expect(JSON.stringify(body)).not.toContain("password");
  });
});
