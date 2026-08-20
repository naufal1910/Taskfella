"use client";

import { useEffect } from "react";
import {
  APPEARANCE_CHANGE_EVENT,
  applyAppearance,
  compareAppearanceRevisions,
  isAppearancePreference,
  readAppearanceCookie,
  readAppearanceRevision,
  type AppearancePreference,
} from "./theme";

interface ThemeControllerProps {
  initialPreference: AppearancePreference;
  serverOwnsPreference: boolean;
  initialRevision?: string;
}

export function ThemeController({
  initialPreference,
  serverOwnsPreference,
  initialRevision,
}: ThemeControllerProps) {
  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    let authoritativePreference = serverOwnsPreference ? initialPreference : undefined;
    let authoritativeRevision = serverOwnsPreference ? initialRevision : readAppearanceRevision();
    let authenticationReset = false;
    const applyCurrent = () => {
      const preference = authoritativePreference ?? readAppearanceCookie();
      applyAppearance(preference, media.matches);
    };
    const updateFromAppearanceEvent = (event: Event) => {
      const detail =
        event instanceof CustomEvent && typeof event.detail === "object" && event.detail !== null
          ? (event.detail as {
              preference?: unknown;
              revision?: unknown;
              authenticated?: boolean;
              reset?: boolean;
            })
          : undefined;
      if (detail && isAppearancePreference(detail.preference)) {
        const revision = typeof detail.revision === "string" ? detail.revision : undefined;
        const reset = detail.reset === true;
        const authenticated = detail.authenticated === true;
        if (reset) {
          authenticationReset = true;
        } else if (authenticated) {
          authenticationReset = false;
        } else if (authenticationReset) {
          return;
        }
        if (
          !reset &&
          revision &&
          authoritativeRevision &&
          compareAppearanceRevisions(revision, authoritativeRevision) < 0
        ) {
          return;
        }
        authoritativePreference = detail.preference;
        authoritativeRevision = revision;
      } else if (!serverOwnsPreference) {
        authoritativePreference = readAppearanceCookie();
        authoritativeRevision = readAppearanceRevision();
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
  }, [initialPreference, initialRevision, serverOwnsPreference]);

  return null;
}
