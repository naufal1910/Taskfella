"use client";

import { useEffect } from "react";
import { APPEARANCE_CHANGE_EVENT, applyAppearance, readAppearanceCookie } from "./theme";

export function ThemeController() {
  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const update = () => {
      const preference = readAppearanceCookie();
      applyAppearance(preference, media.matches);
    };

    update();
    media.addEventListener("change", update);
    window.addEventListener(APPEARANCE_CHANGE_EVENT, update);
    return () => {
      media.removeEventListener("change", update);
      window.removeEventListener(APPEARANCE_CHANGE_EVENT, update);
    };
  }, []);

  return null;
}
