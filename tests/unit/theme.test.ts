import { runInNewContext } from "node:vm";
import { describe, expect, it } from "vitest";
import { themeBootstrap } from "@/app/layout";
import {
  APPEARANCE_CHANGE_EVENT,
  compareAppearanceRevisions,
  notifyAppearanceChange,
  readAppearancePreferenceFromCookie,
  resolveAppearance,
} from "@/components/theme/theme";

describe("appearance resolution", () => {
  function runBootstrap(
    initialAppearance: {
      preference: "system" | "light" | "dark";
      serverOwnsPreference: boolean;
    },
    cookie: string,
    systemDark: boolean,
  ): { theme: string; colorScheme: string } {
    const root = { dataset: {} as Record<string, string>, style: { colorScheme: "" } };
    runInNewContext(themeBootstrap(initialAppearance), {
      document: { cookie, documentElement: root },
      window: { matchMedia: () => ({ matches: systemDark }) },
    });
    return { theme: root.dataset.theme, colorScheme: root.style.colorScheme };
  }

  it("uses the authenticated server preference before first paint", () => {
    expect(
      runBootstrap(
        { preference: "dark", serverOwnsPreference: true },
        "taskfella_appearance=light",
        false,
      ),
    ).toEqual({ theme: "dark", colorScheme: "dark" });
  });

  it("resolves invalid public cache data through the system preference", () => {
    expect(
      runBootstrap(
        { preference: "system", serverOwnsPreference: false },
        "taskfella_appearance=%",
        true,
      ),
    ).toEqual({ theme: "dark", colorScheme: "dark" });
  });

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
      notifyAppearanceChange("dark", "42", {
        authenticated: true,
        identity: "account-a",
      });
      expect(received).toEqual({
        preference: "dark",
        revision: "42",
        authenticated: true,
        identity: "account-a",
        reset: false,
      });
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
