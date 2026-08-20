export const APPEARANCE_COOKIE = "taskfella_appearance";
export const APPEARANCE_REVISION_COOKIE = "taskfella_appearance_revision";
export const APPEARANCE_IDENTITY_COOKIE = "taskfella_appearance_identity";
export const APPEARANCE_GENERATION_COOKIE = "taskfella_appearance_generation";
export const APPEARANCE_RESET_REVISION = "reset";
const APPEARANCE_COOKIE_MAX_AGE_SECONDS = 365 * 24 * 60 * 60;
export const APPEARANCE_CHANGE_EVENT = "taskfella:appearance-change";
export const APPEARANCE_PREFERENCES = ["system", "light", "dark"] as const;
export type AppearancePreference = (typeof APPEARANCE_PREFERENCES)[number];
export type ResolvedAppearance = "light" | "dark";
export { detectBrowserTimezone } from "@/shared/timezone";

let cachedAppearancePreference: AppearancePreference | undefined;
let cachedAppearanceRevision: string | undefined;
let cachedAppearanceIdentity: string | undefined;
let cachedAppearanceGeneration: number | undefined;
let appearanceLifecycleGeneration = 0;

export function beginAppearanceLifecycle(): number {
  const sharedGeneration = readAppearanceGeneration();
  appearanceLifecycleGeneration =
    Math.max(appearanceLifecycleGeneration, sharedGeneration ?? 0) + 1;
  return appearanceLifecycleGeneration;
}

export function currentAppearanceLifecycleGeneration(): number {
  const sharedGeneration = readAppearanceGeneration();
  if (sharedGeneration !== undefined) {
    appearanceLifecycleGeneration = Math.max(appearanceLifecycleGeneration, sharedGeneration);
  }
  return appearanceLifecycleGeneration;
}

export function isCurrentAppearanceLifecycle(generation: number): boolean {
  return currentAppearanceLifecycleGeneration() === generation;
}

export function notifyAppearanceChange(
  preference: AppearancePreference,
  revision?: string,
  options: {
    authenticated?: boolean;
    generation?: number;
    identity?: string;
    reset?: boolean;
  } = {},
): void {
  if (typeof document !== "undefined") {
    const sharedRevision = readAppearanceRevision();
    const sharedIdentity = readAppearanceIdentity();
    const sharedGeneration = readAppearanceGeneration();
    if (
      options.generation !== undefined &&
      sharedGeneration !== undefined &&
      options.generation < sharedGeneration
    ) {
      return;
    }
    if (
      options.identity &&
      sharedIdentity &&
      options.identity !== sharedIdentity &&
      options.generation === undefined
    ) {
      return;
    }
    if (
      revision &&
      sharedRevision &&
      options.identity === sharedIdentity &&
      compareAppearanceRevisions(revision, sharedRevision) < 0
    ) {
      return;
    }
  }
  if (
    options.generation !== undefined &&
    cachedAppearanceGeneration !== undefined &&
    options.generation < cachedAppearanceGeneration
  ) {
    return;
  }
  if (
    revision &&
    (revision === APPEARANCE_RESET_REVISION ||
      (options.generation !== undefined &&
        (cachedAppearanceGeneration === undefined ||
          options.generation >= cachedAppearanceGeneration)) ||
      options.identity !== cachedAppearanceIdentity ||
      !cachedAppearanceRevision ||
      compareAppearanceRevisions(revision, cachedAppearanceRevision) >= 0)
  ) {
    cachedAppearancePreference = preference;
    cachedAppearanceRevision = revision;
    cachedAppearanceIdentity = options.identity;
    cachedAppearanceGeneration = options.generation ?? cachedAppearanceGeneration;
  }
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent(APPEARANCE_CHANGE_EVENT, {
        detail: {
          preference,
          revision,
          authenticated: options.authenticated === true,
          generation: options.generation,
          identity: options.identity,
          reset: options.reset === true,
        },
      }),
    );
  }
}

export function cacheAppearancePreference(
  preference: AppearancePreference,
  revision?: string,
  identity?: string,
  generation?: number,
): void {
  if (typeof document === "undefined") return;
  const sharedRevision = readAppearanceRevision();
  const sharedIdentity = readAppearanceIdentity();
  const sharedGeneration = readAppearanceGeneration();
  if (generation !== undefined && sharedGeneration !== undefined && generation < sharedGeneration) {
    return;
  }
  if (identity && sharedIdentity && identity !== sharedIdentity && generation === undefined) {
    return;
  }
  if (
    revision &&
    sharedRevision &&
    identity === sharedIdentity &&
    compareAppearanceRevisions(revision, sharedRevision) < 0
  ) {
    return;
  }
  if (
    generation !== undefined &&
    cachedAppearanceGeneration !== undefined &&
    generation < cachedAppearanceGeneration
  ) {
    if (cachedAppearancePreference) {
      writeAppearanceCache(
        cachedAppearancePreference,
        cachedAppearanceRevision,
        cachedAppearanceIdentity,
        cachedAppearanceGeneration,
      );
    }
    return;
  }
  if (
    revision &&
    cachedAppearanceRevision &&
    identity === cachedAppearanceIdentity &&
    compareAppearanceRevisions(revision, cachedAppearanceRevision) < 0
  ) {
    if (cachedAppearancePreference) {
      writeAppearanceCache(
        cachedAppearancePreference,
        cachedAppearanceRevision,
        cachedAppearanceIdentity,
        cachedAppearanceGeneration,
      );
    }
    return;
  }
  cachedAppearancePreference = preference;
  cachedAppearanceRevision = revision;
  cachedAppearanceIdentity = identity;
  cachedAppearanceGeneration = generation ?? cachedAppearanceGeneration;
  writeAppearanceCache(preference, revision, identity, generation);
}

function writeAppearanceCache(
  preference: AppearancePreference,
  revision?: string,
  identity?: string,
  generation?: number,
): void {
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
  if (revision) {
    document.cookie = [
      APPEARANCE_REVISION_COOKIE + "=" + encodeURIComponent(revision),
      "path=/",
      "max-age=" + APPEARANCE_COOKIE_MAX_AGE_SECONDS,
      "samesite=lax",
      secure ? "secure" : undefined,
    ]
      .filter(Boolean)
      .join("; ");
  }
  if (identity) {
    document.cookie = [
      APPEARANCE_IDENTITY_COOKIE + "=" + encodeURIComponent(identity),
      "path=/",
      "max-age=" + APPEARANCE_COOKIE_MAX_AGE_SECONDS,
      "samesite=lax",
      secure ? "secure" : undefined,
    ]
      .filter(Boolean)
      .join("; ");
  }
  if (generation !== undefined) {
    document.cookie = [
      APPEARANCE_GENERATION_COOKIE + "=" + generation,
      "path=/",
      "max-age=" + APPEARANCE_COOKIE_MAX_AGE_SECONDS,
      "samesite=lax",
      secure ? "secure" : undefined,
    ]
      .filter(Boolean)
      .join("; ");
  }
}

export function clearAppearancePreferenceCache(): void {
  if (typeof document === "undefined") return;
  cachedAppearancePreference = undefined;
  cachedAppearanceRevision = undefined;
  document.cookie = APPEARANCE_COOKIE + "=; path=/; max-age=0";
  document.cookie = APPEARANCE_REVISION_COOKIE + "=; path=/; max-age=0";
  document.cookie = APPEARANCE_IDENTITY_COOKIE + "=; path=/; max-age=0";
  document.cookie = APPEARANCE_GENERATION_COOKIE + "=; path=/; max-age=0";
  cachedAppearanceIdentity = undefined;
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

export function compareAppearanceRevisions(left: string, right: string): number {
  if (left === APPEARANCE_RESET_REVISION) return right === left ? 0 : -1;
  if (right === APPEARANCE_RESET_REVISION) return 1;
  if (/^\d+$/.test(left) && /^\d+$/.test(right)) {
    const leftValue = BigInt(left);
    const rightValue = BigInt(right);
    return leftValue < rightValue ? -1 : leftValue > rightValue ? 1 : 0;
  }
  const leftTime = Date.parse(left);
  const rightTime = Date.parse(right);
  if (Number.isFinite(leftTime) && Number.isFinite(rightTime)) {
    return leftTime < rightTime ? -1 : leftTime > rightTime ? 1 : 0;
  }
  return left < right ? -1 : left > right ? 1 : 0;
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

function readCookie(name: string): string | undefined {
  const prefix = name + "=";
  const part = document.cookie
    .split(";")
    .map((value) => value.trim())
    .find((value) => value.startsWith(prefix));
  if (!part) return undefined;
  try {
    return decodeURIComponent(part.slice(prefix.length));
  } catch {
    return undefined;
  }
}

export function readAppearanceRevision(): string | undefined {
  return readCookie(APPEARANCE_REVISION_COOKIE);
}

export function readAppearanceIdentity(): string | undefined {
  return readCookie(APPEARANCE_IDENTITY_COOKIE);
}

export function readAppearanceGeneration(): number | undefined {
  const value = readCookie(APPEARANCE_GENERATION_COOKIE);
  if (!value || !/^\d+$/.test(value)) return undefined;
  return Number(value);
}

export function applyAppearanceFromCookie(): ResolvedAppearance {
  const media = window.matchMedia("(prefers-color-scheme: dark)");
  return applyAppearance(readAppearanceCookie(), media.matches);
}
