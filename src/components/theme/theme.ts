export const APPEARANCE_COOKIE = "taskfella_appearance";
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
let cachedAppearanceEpoch: string | undefined;

interface AppearanceMetadata {
  preference: AppearancePreference;
  revision?: string;
  identity?: string;
  epoch?: string;
}

function isAppearanceRevision(value: string): boolean {
  return value === APPEARANCE_RESET_REVISION || /^\d+$/.test(value);
}

function isOpaqueIdentifier(value: string): boolean {
  return /^[A-Za-z0-9._:-]{1,128}$/.test(value);
}

function readAppearanceMetadata(): AppearanceMetadata | undefined {
  if (typeof document === "undefined") return undefined;
  const prefix = `${APPEARANCE_COOKIE}=`;
  const part = document.cookie
    .split(";")
    .map((value) => value.trim())
    .find((value) => value.startsWith(prefix));
  if (!part) return undefined;
  try {
    const parsed = JSON.parse(decodeURIComponent(part.slice(prefix.length))) as Record<
      string,
      unknown
    >;
    if (!isAppearancePreference(parsed.preference)) return undefined;
    if (
      (parsed.revision !== undefined &&
        (typeof parsed.revision !== "string" || !isAppearanceRevision(parsed.revision))) ||
      (parsed.identity !== undefined &&
        (typeof parsed.identity !== "string" || !isOpaqueIdentifier(parsed.identity))) ||
      (parsed.epoch !== undefined &&
        (typeof parsed.epoch !== "string" || !isOpaqueIdentifier(parsed.epoch)))
    ) {
      return undefined;
    }
    return {
      preference: parsed.preference,
      revision: parsed.revision as string | undefined,
      identity: parsed.identity as string | undefined,
      epoch: parsed.epoch as string | undefined,
    };
  } catch {
    return undefined;
  }
}

export function setAppearanceAuthEpoch(epoch: string, reset = false): void {
  if (!isOpaqueIdentifier(epoch)) return;
  cachedAppearanceEpoch = epoch;
  if (reset) {
    cachedAppearancePreference = "system";
    cachedAppearanceRevision = APPEARANCE_RESET_REVISION;
    cachedAppearanceIdentity = undefined;
  }
  writeAppearanceCache(
    cachedAppearancePreference ?? "system",
    cachedAppearanceRevision,
    cachedAppearanceIdentity,
    epoch,
  );
}

export function currentAppearanceAuthEpoch(): string | undefined {
  const epoch = readAppearanceMetadata()?.epoch;
  cachedAppearanceEpoch = epoch;
  return epoch;
}

export function isCurrentAppearanceAuthEpoch(epoch: string | undefined): boolean {
  return currentAppearanceAuthEpoch() === epoch;
}

export function notifyAppearanceChange(
  preference: AppearancePreference,
  revision?: string,
  options: {
    authenticated?: boolean;
    generation?: string;
    identity?: string;
    reset?: boolean;
  } = {},
): void {
  if (typeof document !== "undefined") {
    const shared = readAppearanceMetadata();
    const sharedRevision = shared?.revision;
    const sharedIdentity = shared?.identity;
    const sharedGeneration = shared?.epoch;
    if (revision && !isAppearanceRevision(revision)) return;
    if (
      options.generation !== undefined &&
      sharedGeneration !== undefined &&
      options.generation !== sharedGeneration
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
    cachedAppearanceEpoch !== undefined &&
    options.generation !== cachedAppearanceEpoch
  ) {
    return;
  }
  if (
    revision &&
    (revision === APPEARANCE_RESET_REVISION ||
      (options.generation !== undefined &&
        (cachedAppearanceEpoch === undefined || options.generation === cachedAppearanceEpoch)) ||
      options.identity !== cachedAppearanceIdentity ||
      !cachedAppearanceRevision ||
      compareAppearanceRevisions(revision, cachedAppearanceRevision) >= 0)
  ) {
    cachedAppearancePreference = preference;
    cachedAppearanceRevision = revision;
    cachedAppearanceIdentity = options.identity;
    cachedAppearanceEpoch = options.generation ?? cachedAppearanceEpoch;
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

export function isAppearanceSnapshotCurrent(
  revision?: string,
  identity?: string,
  generation?: string,
  requestGeneration?: string,
): boolean {
  if (typeof document === "undefined") return false;
  if (revision && !isAppearanceRevision(revision)) return false;
  const shared = readAppearanceMetadata();
  const sharedRevision = shared?.revision;
  const sharedIdentity = shared?.identity;
  const sharedGeneration = shared?.epoch;
  if (
    generation !== undefined &&
    sharedGeneration !== undefined &&
    generation !== sharedGeneration &&
    requestGeneration !== sharedGeneration
  ) {
    return false;
  }
  if (identity && sharedIdentity && identity !== sharedIdentity && generation === undefined) {
    return false;
  }
  if (
    revision &&
    sharedRevision &&
    identity === sharedIdentity &&
    compareAppearanceRevisions(revision, sharedRevision) < 0
  ) {
    return false;
  }
  if (
    generation !== undefined &&
    cachedAppearanceEpoch !== undefined &&
    generation !== cachedAppearanceEpoch &&
    requestGeneration !== cachedAppearanceEpoch
  ) {
    return false;
  }
  if (
    revision &&
    cachedAppearanceRevision &&
    identity === cachedAppearanceIdentity &&
    compareAppearanceRevisions(revision, cachedAppearanceRevision) < 0
  ) {
    return false;
  }
  return true;
}

export function cacheAppearancePreference(
  preference: AppearancePreference,
  revision?: string,
  identity?: string,
  generation?: string,
  requestGeneration?: string,
): boolean {
  if (typeof document === "undefined") return false;
  if (!isAppearanceSnapshotCurrent(revision, identity, generation, requestGeneration)) {
    const shared = readAppearanceMetadata();
    const sharedRevision = shared?.revision;
    const sharedIdentity = shared?.identity;
    const sharedGeneration = shared?.epoch;
    const sharedStateIsNewer =
      (generation !== undefined &&
        sharedGeneration !== undefined &&
        generation !== sharedGeneration &&
        requestGeneration !== sharedGeneration) ||
      (revision !== undefined &&
        sharedRevision !== undefined &&
        identity === sharedIdentity &&
        compareAppearanceRevisions(revision, sharedRevision) < 0);
    const localStateIsNewer =
      (generation !== undefined &&
        cachedAppearanceEpoch !== undefined &&
        generation === cachedAppearanceEpoch &&
        requestGeneration !== cachedAppearanceEpoch &&
        revision !== undefined &&
        cachedAppearanceRevision !== undefined &&
        compareAppearanceRevisions(revision, cachedAppearanceRevision) < 0) ||
      (revision !== undefined &&
        cachedAppearanceRevision !== undefined &&
        identity === cachedAppearanceIdentity &&
        compareAppearanceRevisions(revision, cachedAppearanceRevision) < 0);
    if (!sharedStateIsNewer && localStateIsNewer && cachedAppearancePreference) {
      writeAppearanceCache(
        cachedAppearancePreference,
        cachedAppearanceRevision,
        cachedAppearanceIdentity,
        cachedAppearanceEpoch,
      );
    }
    return false;
  }
  cachedAppearancePreference = preference;
  cachedAppearanceRevision = revision;
  cachedAppearanceIdentity = identity;
  cachedAppearanceEpoch = generation ?? cachedAppearanceEpoch;
  writeAppearanceCache(preference, revision, identity, generation);
  return true;
}

function writeAppearanceCache(
  preference: AppearancePreference,
  revision?: string,
  identity?: string,
  generation?: string,
): void {
  const secure = typeof window !== "undefined" && window.location.protocol === "https:";
  const metadata: AppearanceMetadata = {
    preference,
    ...(revision ? { revision } : {}),
    ...(identity ? { identity } : {}),
    ...(generation ? { epoch: generation } : {}),
  };
  document.cookie = [
    `${APPEARANCE_COOKIE}=${encodeURIComponent(JSON.stringify(metadata))}`,
    "path=/",
    `max-age=${APPEARANCE_COOKIE_MAX_AGE_SECONDS}`,
    "samesite=lax",
    secure ? "secure" : undefined,
  ]
    .filter(Boolean)
    .join("; ");
}

export function clearAppearancePreferenceCache(): void {
  if (typeof document === "undefined") return;
  cachedAppearancePreference = undefined;
  cachedAppearanceRevision = undefined;
  document.cookie = APPEARANCE_COOKIE + "=; path=/; max-age=0";
  cachedAppearanceIdentity = undefined;
  cachedAppearanceEpoch = undefined;
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
  if (!isAppearanceRevision(left) || !isAppearanceRevision(right)) return 0;
  if (left === APPEARANCE_RESET_REVISION) return right === left ? 0 : -1;
  if (right === APPEARANCE_RESET_REVISION) return 1;
  const leftValue = BigInt(left);
  const rightValue = BigInt(right);
  return leftValue < rightValue ? -1 : leftValue > rightValue ? 1 : 0;
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
  return readAppearanceMetadata()?.preference ?? "system";
}

export function readAppearanceRevision(): string | undefined {
  return readAppearanceMetadata()?.revision;
}

export function readAppearanceIdentity(): string | undefined {
  return readAppearanceMetadata()?.identity;
}

export function readAppearanceGeneration(): string | undefined {
  return readAppearanceMetadata()?.epoch;
}

export function applyAppearanceFromCookie(): ResolvedAppearance {
  const media = window.matchMedia("(prefers-color-scheme: dark)");
  return applyAppearance(readAppearanceCookie(), media.matches);
}
