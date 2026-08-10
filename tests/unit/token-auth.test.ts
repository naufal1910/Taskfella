import { describe, expect, it } from "vitest";
import { generateOpaqueToken, hashBearerToken, safeHashEquals } from "@/server/modules/auth/tokens";

describe("opaque authentication tokens", () => {
  it("generates unpredictable values and stores only deterministic digests", () => {
    const first = generateOpaqueToken();
    const second = generateOpaqueToken();

    expect(first).not.toBe(second);
    expect(first).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(hashBearerToken(first)).toHaveLength(64);
    expect(hashBearerToken(first)).toBe(hashBearerToken(first));
    expect(hashBearerToken(first)).not.toBe(first);
    expect(safeHashEquals(hashBearerToken(first), hashBearerToken(first))).toBe(true);
    expect(safeHashEquals(hashBearerToken(first), hashBearerToken(second))).toBe(false);
  });
});
