import { describe, expect, it } from "vitest";
import { applyRequestContext, createRequestId, getRequestContext } from "@/server/http/request-id";

describe("request context", () => {
  it("preserves safe request and correlation IDs", () => {
    const context = getRequestContext(
      new Request("http://localhost/api/health", {
        headers: {
          "x-request-id": "request-123",
          "x-correlation-id": "trace-456",
        },
      }),
    );

    expect(context).toEqual({ requestId: "request-123", correlationId: "trace-456" });
  });

  it("generates a safe ID instead of accepting oversized header content", () => {
    const context = getRequestContext(
      new Request("http://localhost/api/health", {
        headers: { "x-request-id": "x".repeat(129) },
      }),
    );

    expect(context.requestId).not.toBe("x".repeat(129));
    expect(context.requestId).toMatch(/^[0-9a-f-]{36}$/);
    expect(context.correlationId).toBe(context.requestId);
  });

  it("writes both IDs to response headers", () => {
    const headers = new Headers();
    const context = { requestId: createRequestId(), correlationId: "trace-1" };

    applyRequestContext(headers, context);

    expect(headers.get("x-request-id")).toBe(context.requestId);
    expect(headers.get("x-correlation-id")).toBe("trace-1");
  });
});
