"use client";

import { useEffect } from "react";
import {
  APPEARANCE_CHANGE_EVENT,
  applyAppearance,
  isAppearancePreference,
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
    let authoritativePreference = serverOwnsPreference ? initialPreference : undefined;
    const applyCurrent = () => {
      const preference = authoritativePreference ?? readAppearanceCookie();
      applyAppearance(preference, media.matches);
    };
    const updateFromAppearanceEvent = (event: Event) => {
      if (event instanceof CustomEvent && isAppearancePreference(event.detail)) {
        authoritativePreference = event.detail;
      } else if (!serverOwnsPreference) {
        authoritativePreference = readAppearanceCookie();
      }
      applyCurrent();
    };

    applyCurrent();
    media.addEventListener("change", applyCurrent);
    window.addEventListener(APPEARANCE_CHANGE_EVENT, updateFromAppearanceEvent);
    return () => {
      media.removeEventListener("change", applyCurrent);
      window.removeEventListener(APPEARANCE_CHANGE_EVENT, updateFromAppearanceEvent);
    };
  }, [initialPreference, serverOwnsPreference]);

  return null;
}
