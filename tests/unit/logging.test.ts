import { describe, expect, it, vi } from "vitest";
import { logger } from "@/server/observability/logger";

describe("structured logging", () => {
  it("emits only allow-listed technical context", () => {
    const output = vi.spyOn(console, "log").mockImplementation(() => undefined);

    logger.info("health_check_succeeded", {
      requestId: "request-1",
      correlationId: "trace-1",
      status: 200,
      component: "health",
    });

    const record = JSON.parse(output.mock.calls[0]?.[0] as string) as Record<string, unknown>;
    expect(record).toMatchObject({
      service: "taskfella",
      level: "info",
      event: "health_check_succeeded",
      requestId: "request-1",
      correlationId: "trace-1",
      status: 200,
      component: "health",
    });
    expect(record).not.toHaveProperty("password");
    expect(record).not.toHaveProperty("content");
    output.mockRestore();
  });
});
