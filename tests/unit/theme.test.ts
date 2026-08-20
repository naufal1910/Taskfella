import { describe, expect, it } from "vitest";
import {
  APPEARANCE_CHANGE_EVENT,
  compareAppearanceRevisions,
  notifyAppearanceChange,
  readAppearancePreferenceFromCookie,
  resolveAppearance,
} from "@/components/theme/theme";

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

  it("publishes the refreshed preference to the mounted controller", () => {
    const previousWindow = globalThis.window;
    const testWindow = new EventTarget();
    let received: unknown;
    testWindow.addEventListener(APPEARANCE_CHANGE_EVENT, (event) => {
      received = (event as CustomEvent).detail;
    });
    Object.defineProperty(globalThis, "window", { configurable: true, value: testWindow });

    try {
      notifyAppearanceChange("dark", "42");
      expect(received).toEqual({ preference: "dark", revision: "42" });
    } finally {
      if (previousWindow === undefined) {
        Reflect.deleteProperty(globalThis, "window");
      } else {
        Object.defineProperty(globalThis, "window", {
          configurable: true,
          value: previousWindow,
        });
      }
    }
  });

  it("orders numeric appearance revisions", () => {
    expect(compareAppearanceRevisions("42", "41")).toBeGreaterThan(0);
    expect(compareAppearanceRevisions("41", "42")).toBeLessThan(0);
    expect(compareAppearanceRevisions("42", "42")).toBe(0);
  });
});
