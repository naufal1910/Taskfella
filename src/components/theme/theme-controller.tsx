"use client";

import { useEffect } from "react";
import {
  APPEARANCE_CHANGE_EVENT,
  applyAppearance,
  readAppearanceCookie,
  type AppearancePreference,
} from "./theme";

interface ThemeControllerProps {
  initialPreference: AppearancePreference;
  serverOwnsPreference: boolean;
}

export function ThemeController({ initialPreference, serverOwnsPreference }: ThemeControllerProps) {
  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const update = () => {
      const preference = readAppearanceCookie();
      applyAppearance(preference, media.matches);
    };

    applyAppearance(
      serverOwnsPreference ? initialPreference : readAppearanceCookie(),
      media.matches,
    );
    media.addEventListener("change", update);
    window.addEventListener(APPEARANCE_CHANGE_EVENT, update);
    return () => {
      media.removeEventListener("change", update);
      window.removeEventListener(APPEARANCE_CHANGE_EVENT, update);
    };
  }, [initialPreference, serverOwnsPreference]);

  return null;
}
