import { describe, expect, it } from "vitest";
import { AppError } from "@/server/http/errors";
import { evaluateWip } from "@/server/modules/workflow/wip";

describe("server-side WIP policy", () => {
  it("allows unlimited columns without warning", () => {
    expect(evaluateWip("none", null, 100)).toMatchObject({ allowed: true, warning: false });
  });

  it("returns a warning decision only after explicit confirmation", () => {
    expect(() => evaluateWip("warn", 2, 2)).toThrowError(AppError);
    expect(() => evaluateWip("warn", 2, 2)).toThrowError(/confirm/i);
    expect(evaluateWip("warn", 2, 2, true)).toMatchObject({ allowed: true, warning: true });
  });

  it("authoritatively blocks enforce overflow", () => {
    expect(() => evaluateWip("enforce", 2, 2, true)).toThrowError(/reached/i);
    expect(evaluateWip("enforce", 2, 1)).toMatchObject({ allowed: true, warning: false });
  });

  it("rejects inconsistent mode and limit values", () => {
    expect(() => evaluateWip("none", 2, 0)).toThrowError(AppError);
    expect(() => evaluateWip("enforce", null, 0)).toThrowError(AppError);
    expect(() => evaluateWip("warn", 0, 0)).toThrowError(AppError);
  });
});
