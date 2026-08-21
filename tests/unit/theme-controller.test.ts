import { describe, expect, it, vi } from "vitest";

vi.mock("react", () => ({
  useEffect: (effect: () => unknown) => {
    effect();
  },
}));

import { ThemeController } from "@/components/theme/theme-controller";
import { APPEARANCE_CHANGE_EVENT } from "@/components/theme/theme";

describe("theme controller lifecycle", () => {
  it("applies a reset epoch even when it differs from the authenticated session", () => {
    const previousDocument = globalThis.document;
    const previousWindow = globalThis.window;
    const media = new EventTarget() as EventTarget & { matches: boolean };
    media.matches = false;
    const browserWindow = new EventTarget() as EventTarget & {
      matchMedia: () => typeof media;
    };
    browserWindow.matchMedia = () => media;
    const root = { dataset: {} as Record<string, string>, style: { colorScheme: "" } };
    const browserDocument = {
      cookie: `taskfella_appearance=${encodeURIComponent(
        JSON.stringify({ preference: "system", revision: "reset", epoch: "epoch-reset" }),
      )}`,
      documentElement: root,
    };

    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: browserWindow,
    });
    Object.defineProperty(globalThis, "document", {
      configurable: true,
      value: browserDocument,
    });

    try {
      ThemeController({
        initialPreference: "dark",
        serverOwnsPreference: true,
        initialRevision: "7",
        initialIdentity: "account-a",
        initialGeneration: "epoch-account-a",
      });
      expect(root.dataset.theme).toBe("dark");

      browserWindow.dispatchEvent(
        new CustomEvent(APPEARANCE_CHANGE_EVENT, {
          detail: {
            preference: "system",
            revision: "reset",
            generation: "epoch-reset",
            reset: true,
          },
        }),
      );

      expect(root.dataset.theme).toBe("light");
      expect(root.style.colorScheme).toBe("light");
    } finally {
      if (previousDocument === undefined) {
        Reflect.deleteProperty(globalThis, "document");
      } else {
        Object.defineProperty(globalThis, "document", {
          configurable: true,
          value: previousDocument,
        });
      }
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
});
