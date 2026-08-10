import { describe, expect, it } from "vitest";
import { AppError, appErrorResponse, toAppError } from "@/server/http/errors";

describe("application errors", () => {
  it("maps known errors to stable public responses", async () => {
    const response = appErrorResponse(new AppError("CONFLICT"), "request-1");

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      error: {
        code: "CONFLICT",
        message: "The request conflicts with the current application state.",
      },
      requestId: "request-1",
    });
  });

  it("sanitizes unexpected errors", async () => {
    const response = appErrorResponse(
      new Error("database password should never be returned"),
      "request-2",
    );

    expect(toAppError(new Error("private detail")).code).toBe("INTERNAL_ERROR");
    await expect(response.json()).resolves.toEqual({
      error: {
        code: "INTERNAL_ERROR",
        message: "An unexpected error occurred.",
      },
      requestId: "request-2",
    });
  });
});
