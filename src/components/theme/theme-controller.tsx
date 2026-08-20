"use client";

import { useEffect } from "react";
import { applyAppearance, applyAppearanceFromCookie, readAppearanceCookie } from "./theme";

export function ThemeController() {
  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const update = () => {
      const preference = readAppearanceCookie();
      applyAppearance(preference, media.matches);
    };

    applyAppearanceFromCookie();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  return null;
}
