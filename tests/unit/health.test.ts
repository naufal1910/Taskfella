import { describe, expect, it } from "vitest";
import { evaluateHealth } from "@/server/health";

describe("health evaluation", () => {
  it("reports ready only when the database readiness check succeeds", async () => {
    const health = await evaluateHealth("request-1", "trace-1", async () => true);

    expect(health).toEqual({
      status: "ok",
      application: "ok",
      database: "ready",
      requestId: "request-1",
      correlationId: "trace-1",
      httpStatus: 200,
    });
  });

  it("returns a safe non-success readiness result when the database is unavailable", async () => {
    const health = await evaluateHealth("request-2", "trace-2", async () => false);

    expect(health.status).toBe("degraded");
    expect(health.application).toBe("ok");
    expect(health.database).toBe("unavailable");
    expect(health.httpStatus).toBe(503);
    expect(JSON.stringify(health)).not.toContain("DATABASE_URL");
  });

  it("converts database exceptions into the same safe unavailable result", async () => {
    const health = await evaluateHealth("request-3", "trace-3", async () => {
      throw new Error("postgres password should not escape");
    });

    expect(health.database).toBe("unavailable");
    expect(health.httpStatus).toBe(503);
    expect(JSON.stringify(health)).not.toContain("postgres password");
  });
});
