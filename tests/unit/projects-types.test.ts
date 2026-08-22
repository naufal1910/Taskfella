import { describe, expect, it } from "vitest";
import { AppError } from "@/server/http/errors";
import { normalizePosition, normalizedLabelName } from "@/server/modules/projects/types";

describe("project workflow input normalization", () => {
  it("rejects normalized label names that exceed the database limit", () => {
    expect(() => normalizedLabelName("ﬀ".repeat(60))).toThrowError(AppError);
  });

  it("rejects positions outside the PostgreSQL integer range", () => {
    expect(() => normalizePosition(2_147_483_648, 0)).toThrowError(AppError);
    expect(normalizePosition(2_147_483_647, 0)).toBe(2_147_483_647);
  });
});
