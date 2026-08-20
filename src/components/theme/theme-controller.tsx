"use client";

import { useEffect } from "react";
import {
  APPEARANCE_CHANGE_EVENT,
  applyAppearance,
  compareAppearanceRevisions,
  isAppearancePreference,
  readAppearanceCookie,
  readAppearanceGeneration,
  readAppearanceIdentity,
  readAppearanceRevision,
  type AppearancePreference,
} from "./theme";

interface ThemeControllerProps {
  initialPreference: AppearancePreference;
  serverOwnsPreference: boolean;
  initialRevision?: string;
  initialIdentity?: string;
}

export function ThemeController({
  initialPreference,
  serverOwnsPreference,
  initialRevision,
  initialIdentity,
}: ThemeControllerProps) {
  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    let authoritativePreference = serverOwnsPreference ? initialPreference : undefined;
    let authoritativeRevision = serverOwnsPreference ? initialRevision : readAppearanceRevision();
    let authoritativeIdentity = serverOwnsPreference ? initialIdentity : readAppearanceIdentity();
    let authoritativeGeneration = readAppearanceGeneration();
    let authenticationReset = serverOwnsPreference && !initialIdentity;
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
              generation?: unknown;
              identity?: unknown;
              reset?: boolean;
            })
          : undefined;
      if (detail && isAppearancePreference(detail.preference)) {
        const revision = typeof detail.revision === "string" ? detail.revision : undefined;
        const generation = typeof detail.generation === "number" ? detail.generation : undefined;
        const identity = typeof detail.identity === "string" ? detail.identity : undefined;
        const reset = detail.reset === true;
        const authenticated = detail.authenticated === true;
        const sharedGeneration = readAppearanceGeneration();
        const sharedRevision = readAppearanceRevision();
        const sharedIdentity = readAppearanceIdentity();
        if (
          generation !== undefined &&
          sharedGeneration !== undefined &&
          generation < sharedGeneration
        ) {
          return;
        }
        if (
          authenticated &&
          revision &&
          sharedRevision &&
          identity === sharedIdentity &&
          compareAppearanceRevisions(revision, sharedRevision) < 0
        ) {
          return;
        }
        if (
          generation !== undefined &&
          authoritativeGeneration !== undefined &&
          generation < authoritativeGeneration
        ) {
          return;
        }
        if (
          authenticated &&
          (authenticationReset || authoritativeGeneration !== undefined) &&
          generation === undefined
        ) {
          return;
        }
        if (
          authenticated &&
          authenticationReset &&
          authoritativeGeneration !== undefined &&
          generation !== undefined &&
          generation <= authoritativeGeneration
        ) {
          return;
        }
        if (
          authenticated &&
          identity &&
          authoritativeIdentity &&
          identity !== authoritativeIdentity &&
          (generation === undefined ||
            authoritativeGeneration === undefined ||
            generation <= authoritativeGeneration)
        ) {
          return;
        }
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
          identity === authoritativeIdentity &&
          compareAppearanceRevisions(revision, authoritativeRevision) < 0
        ) {
          return;
        }
        authoritativePreference = detail.preference;
        authoritativeRevision = revision;
        authoritativeGeneration = generation ?? authoritativeGeneration;
        authoritativeIdentity = reset ? undefined : (identity ?? authoritativeIdentity);
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
  }, [initialIdentity, initialPreference, initialRevision, serverOwnsPreference]);

  return null;
}
