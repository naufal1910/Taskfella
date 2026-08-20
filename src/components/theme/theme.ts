export const APPEARANCE_COOKIE = "taskfella_appearance";
const APPEARANCE_COOKIE_MAX_AGE_SECONDS = 365 * 24 * 60 * 60;
export const APPEARANCE_CHANGE_EVENT = "taskfella:appearance-change";
export const APPEARANCE_PREFERENCES = ["system", "light", "dark"] as const;
export type AppearancePreference = (typeof APPEARANCE_PREFERENCES)[number];
export type ResolvedAppearance = "light" | "dark";
export { detectBrowserTimezone } from "@/shared/timezone";

export function notifyAppearanceChange(preference?: AppearancePreference): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent(APPEARANCE_CHANGE_EVENT, {
        detail: preference,
      }),
    );
  }
}

export function cacheAppearancePreference(preference: AppearancePreference): void {
  if (typeof document === "undefined") return;
  const secure = typeof window !== "undefined" && window.location.protocol === "https:";
  document.cookie = [
    `${APPEARANCE_COOKIE}=${encodeURIComponent(preference)}`,
    "path=/",
    `max-age=${APPEARANCE_COOKIE_MAX_AGE_SECONDS}`,
    "samesite=lax",
    secure ? "secure" : undefined,
  ]
    .filter(Boolean)
    .join("; ");
}

export function resolveAppearance(
  preference: AppearancePreference,
  systemPrefersDark: boolean,
): ResolvedAppearance {
  if (preference === "system") return systemPrefersDark ? "dark" : "light";
  return preference;
}

export function isAppearancePreference(value: unknown): value is AppearancePreference {
  return (
    typeof value === "string" && APPEARANCE_PREFERENCES.includes(value as AppearancePreference)
  );
}

export function readAppearancePreferenceFromCookie(
  cookieValue: string | undefined,
): AppearancePreference {
  return isAppearancePreference(cookieValue) ? cookieValue : "system";
}

export function applyAppearance(
  preference: AppearancePreference,
  systemPrefersDark: boolean,
): ResolvedAppearance {
  const resolved = resolveAppearance(preference, systemPrefersDark);
  const root = document.documentElement;
  root.dataset.theme = resolved;
  root.style.colorScheme = resolved;
  return resolved;
}

export function readAppearanceCookie(): AppearancePreference {
  const prefix = `${APPEARANCE_COOKIE}=`;
  const part = document.cookie
    .split(";")
    .map((value) => value.trim())
    .find((value) => value.startsWith(prefix));
  if (!part) return "system";
  try {
    return readAppearancePreferenceFromCookie(decodeURIComponent(part.slice(prefix.length)));
  } catch {
    return "system";
  }
}

export function applyAppearanceFromCookie(): ResolvedAppearance {
  const media = window.matchMedia("(prefers-color-scheme: dark)");
  return applyAppearance(readAppearanceCookie(), media.matches);
}
