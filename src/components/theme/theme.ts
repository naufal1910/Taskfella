export const APPEARANCE_COOKIE = "taskfella_appearance";
export const APPEARANCE_PREFERENCES = ["system", "light", "dark"] as const;
export type AppearancePreference = (typeof APPEARANCE_PREFERENCES)[number];
export type ResolvedAppearance = "light" | "dark";

export function resolveAppearance(
  preference: AppearancePreference,
  systemPrefersDark: boolean,
): ResolvedAppearance {
  if (preference === "system") return systemPrefersDark ? "dark" : "light";
  return preference;
}

export function isAppearancePreference(value: string | undefined): value is AppearancePreference {
  return value !== undefined && APPEARANCE_PREFERENCES.includes(value as AppearancePreference);
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

export function detectBrowserTimezone(): string | undefined {
  try {
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return timezone && timezone.length <= 128 ? timezone : undefined;
  } catch {
    return undefined;
  }
}
