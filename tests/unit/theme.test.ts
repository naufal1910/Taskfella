import { runInNewContext } from "node:vm";
import { describe, expect, it } from "vitest";
import { themeBootstrap } from "@/app/layout";
import {
  APPEARANCE_CHANGE_EVENT,
  cacheAppearancePreference,
  clearAppearancePreferenceCache,
  compareAppearanceRevisions,
  isAppearanceSnapshotCurrent,
  notifyAppearanceChange,
  readAppearancePreferenceFromCookie,
  setAppearanceAuthEpoch,
  resolveAppearance,
} from "@/components/theme/theme";

describe("appearance resolution", () => {
  function appearanceCookie(metadata: Record<string, unknown>): string {
    return `taskfella_appearance=${encodeURIComponent(JSON.stringify(metadata))}`;
  }

  function withCookieDocument(initialCookie: string, callback: () => void): void {
    const previousDocument = globalThis.document;
    const cookies = new Map(
      initialCookie
        .split(";")
        .filter((part) => part.includes("="))
        .map((part) => {
          const separator = part.indexOf("=");
          return [part.slice(0, separator).trim(), part.slice(separator + 1)] as const;
        }),
    );
    const testDocument = {
      get cookie(): string {
        return [...cookies].map(([name, value]) => `${name}=${value}`).join("; ");
      },
      set cookie(value: string) {
        const [pair, ...attributes] = value.split(";");
        const separator = pair.indexOf("=");
        const name = pair.slice(0, separator).trim();
        const cookieValue = pair.slice(separator + 1);
        if (attributes.some((attribute) => attribute.trim() === "max-age=0")) {
          cookies.delete(name);
        } else {
          cookies.set(name, cookieValue);
        }
      },
    };
    Object.defineProperty(globalThis, "document", {
      configurable: true,
      value: testDocument,
    });
    try {
      callback();
    } finally {
      if (previousDocument === undefined) {
        Reflect.deleteProperty(globalThis, "document");
      } else {
        Object.defineProperty(globalThis, "document", {
          configurable: true,
          value: previousDocument,
        });
      }
    }
  }

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
        appearanceCookie({ preference: "light", revision: "0", epoch: "epoch-a" }),
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
    expect(
      runBootstrap(
        { preference: "system", serverOwnsPreference: false },
        appearanceCookie({ preference: "dark", revision: "not-a-revision" }),
        false,
      ),
    ).toEqual({ theme: "light", colorScheme: "light" });
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
        generation: "epoch-a",
        identity: "account-a",
      });
      expect(received).toEqual({
        preference: "dark",
        revision: "42",
        authenticated: true,
        generation: "epoch-a",
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
    expect(compareAppearanceRevisions("reset", "0")).toBeLessThan(0);
    expect(compareAppearanceRevisions("0", "reset")).toBeGreaterThan(0);
  });

  it("does not let an older lifecycle response overwrite shared browser cache", () => {
    withCookieDocument(
      appearanceCookie({
        preference: "dark",
        revision: "1",
        identity: "account-a",
        epoch: "epoch-new",
      }),
      () => {
        expect(isAppearanceSnapshotCurrent("0", "account-a", "epoch-old")).toBe(false);
        expect(cacheAppearancePreference("light", "0", "account-a", "epoch-old")).toBe(false);
        expect(document.cookie).toContain("taskfella_appearance=");
        expect(decodeURIComponent(document.cookie.split("=")[1]!)).toContain('"dark"');
        expect(document.cookie).not.toContain("appearance_revision");
      },
    );
  });

  it("writes preference and metadata as one validated cookie snapshot", () => {
    withCookieDocument("", () => {
      clearAppearancePreferenceCache();
      expect(cacheAppearancePreference("dark", "1", "account-a", "epoch-a")).toBe(true);
      expect(document.cookie.split(";")).toHaveLength(1);
      expect(decodeURIComponent(document.cookie.split("=")[1]!)).toEqual(
        JSON.stringify({
          preference: "dark",
          revision: "1",
          identity: "account-a",
          epoch: "epoch-a",
        }),
      );
    });
  });

  it("accepts a server-issued epoch transition from the request epoch", () => {
    withCookieDocument(appearanceCookie({ preference: "light", epoch: "epoch-old" }), () => {
      clearAppearancePreferenceCache();
      document.cookie = appearanceCookie({ preference: "light", epoch: "epoch-old" });
      expect(cacheAppearancePreference("dark", "1", "account-b", "epoch-new", "epoch-old")).toBe(
        true,
      );
      expect(decodeURIComponent(document.cookie.split("=")[1]!)).toContain('"epoch":"epoch-new"');
    });
  });

  it("keeps the reset generation across appearance-cache clearing", () => {
    withCookieDocument(appearanceCookie({ preference: "dark", epoch: "epoch-old" }), () => {
      clearAppearancePreferenceCache();
      expect(document.cookie).not.toContain("taskfella_appearance=");

      setAppearanceAuthEpoch("epoch-reset", true);
      expect(document.cookie).toContain("taskfella_appearance=");
      expect(decodeURIComponent(document.cookie.split("=")[1]!)).toContain('"epoch":"epoch-reset"');
    });
  });
});
