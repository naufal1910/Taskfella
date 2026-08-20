import { describe, expect, it } from "vitest";
import { readAppearancePreferenceFromCookie, resolveAppearance } from "@/components/theme/theme";

describe("appearance resolution", () => {
  it("uses the system preference only for System", () => {
    expect(resolveAppearance("system", true)).toBe("dark");
    expect(resolveAppearance("system", false)).toBe("light");
    expect(resolveAppearance("light", true)).toBe("light");
    expect(resolveAppearance("dark", false)).toBe("dark");
  });

  it("falls back safely when the cache cookie is missing or invalid", () => {
    expect(readAppearancePreferenceFromCookie(undefined)).toBe("system");
    expect(readAppearancePreferenceFromCookie("sepia")).toBe("system");
    expect(readAppearancePreferenceFromCookie("dark")).toBe("dark");
  });
});
