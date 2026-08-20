import { z } from "zod";
import { AppError } from "@/server/http/errors";

export const APPEARANCE_VALUES = ["system", "light", "dark"] as const;
export type Appearance = (typeof APPEARANCE_VALUES)[number];

export const POMODORO_LIMITS = {
  focusDurationMinutes: { min: 1, max: 120 },
  shortBreakDurationMinutes: { min: 1, max: 60 },
  longBreakDurationMinutes: { min: 1, max: 120 },
  longBreakInterval: { min: 1, max: 12 },
} as const;

export const DEFAULT_ACCOUNT_SETTINGS = {
  displayName: "",
  timezone: "UTC",
  appearance: "system" as Appearance,
  notificationsEnabled: true,
  soundEnabled: true,
  focusDurationMinutes: 25,
  shortBreakDurationMinutes: 5,
  longBreakDurationMinutes: 15,
  longBreakInterval: 4,
};

export type AccountSettings = typeof DEFAULT_ACCOUNT_SETTINGS;

export type AccountSettingsPatch = Partial<AccountSettings>;

const controlCharacterPattern = /[\u0000-\u001f\u007f]/;
const namedIanaTimezones = new Set(Intl.supportedValuesOf("timeZone"));
const displayNameSchema = z.string().max(80);
const timezoneSchema = z.string().min(1).max(128);
const appearanceSchema = z.enum(APPEARANCE_VALUES);
const durationSchema = (key: keyof typeof POMODORO_LIMITS) =>
  z.number().finite().int().min(POMODORO_LIMITS[key].min).max(POMODORO_LIMITS[key].max);

const pomodoroPatchSchema = z
  .object({
    focusDurationMinutes: durationSchema("focusDurationMinutes").optional(),
    shortBreakDurationMinutes: durationSchema("shortBreakDurationMinutes").optional(),
    longBreakDurationMinutes: durationSchema("longBreakDurationMinutes").optional(),
    longBreakInterval: durationSchema("longBreakInterval").optional(),
    // These names keep the API tolerant of the labels used by the settings UI.
    focusDuration: durationSchema("focusDurationMinutes").optional(),
    focus: durationSchema("focusDurationMinutes").optional(),
    shortBreakDuration: durationSchema("shortBreakDurationMinutes").optional(),
    shortBreak: durationSchema("shortBreakDurationMinutes").optional(),
    longBreakDuration: durationSchema("longBreakDurationMinutes").optional(),
    longBreak: durationSchema("longBreakDurationMinutes").optional(),
    longBreakAfter: durationSchema("longBreakInterval").optional(),
    longBreakAfterSessions: durationSchema("longBreakInterval").optional(),
  })
  .strict();

const settingsPatchSchema = z
  .object({
    displayName: displayNameSchema.optional(),
    name: displayNameSchema.optional(),
    profile: z
      .object({
        displayName: displayNameSchema.optional(),
        name: displayNameSchema.optional(),
      })
      .strict()
      .optional(),
    timezone: timezoneSchema.optional(),
    appearance: appearanceSchema.optional(),
    theme: appearanceSchema.optional(),
    notificationsEnabled: z.boolean().optional(),
    notifications: z.boolean().optional(),
    notificationEnabled: z.boolean().optional(),
    soundEnabled: z.boolean().optional(),
    sound: z.boolean().optional(),
    focusDurationMinutes: durationSchema("focusDurationMinutes").optional(),
    shortBreakDurationMinutes: durationSchema("shortBreakDurationMinutes").optional(),
    longBreakDurationMinutes: durationSchema("longBreakDurationMinutes").optional(),
    longBreakInterval: durationSchema("longBreakInterval").optional(),
    pomodoro: pomodoroPatchSchema.optional(),
  })
  .strict();

function invalidSettings(): never {
  throw new AppError("INVALID_REQUEST");
}

function chooseValue<T>(values: Array<T | undefined>): T | undefined {
  const present = values.filter((value): value is T => value !== undefined);
  if (present.length === 0) return undefined;
  const first = present[0];
  if (present.some((value) => value !== first)) invalidSettings();
  return first;
}

export function isValidTimezone(value: string): boolean {
  if (
    value.length === 0 ||
    value.length > 128 ||
    value.trim() !== value ||
    controlCharacterPattern.test(value)
  ) {
    return false;
  }

  if (value !== "UTC" && !namedIanaTimezones.has(value)) return false;

  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value }).format();
    return true;
  } catch {
    return false;
  }
}

export function validateTimezone(value: string): string {
  if (!isValidTimezone(value)) invalidSettings();
  return value;
}

function normalizeDisplayName(value: string): string {
  if (controlCharacterPattern.test(value)) invalidSettings();
  const normalized = value.normalize("NFKC").trim();
  if (normalized.length > 80) invalidSettings();
  return normalized;
}

function patchValue(
  parsed: z.infer<typeof settingsPatchSchema>,
  key: keyof AccountSettings,
): unknown {
  const nested = parsed.pomodoro;
  switch (key) {
    case "displayName":
      return chooseValue([
        parsed.displayName,
        parsed.name,
        parsed.profile?.displayName,
        parsed.profile?.name,
      ]);
    case "notificationsEnabled":
      return chooseValue([
        parsed.notificationsEnabled,
        parsed.notifications,
        parsed.notificationEnabled,
      ]);
    case "soundEnabled":
      return chooseValue([parsed.soundEnabled, parsed.sound]);
    case "focusDurationMinutes":
      return chooseValue([
        parsed.focusDurationMinutes,
        nested?.focusDurationMinutes,
        nested?.focusDuration,
        nested?.focus,
      ]);
    case "shortBreakDurationMinutes":
      return chooseValue([
        parsed.shortBreakDurationMinutes,
        nested?.shortBreakDurationMinutes,
        nested?.shortBreakDuration,
        nested?.shortBreak,
      ]);
    case "longBreakDurationMinutes":
      return chooseValue([
        parsed.longBreakDurationMinutes,
        nested?.longBreakDurationMinutes,
        nested?.longBreakDuration,
        nested?.longBreak,
      ]);
    case "longBreakInterval":
      return chooseValue([
        parsed.longBreakInterval,
        nested?.longBreakInterval,
        nested?.longBreakAfter,
        nested?.longBreakAfterSessions,
      ]);
    default:
      return key === "appearance" ? chooseValue([parsed.appearance, parsed.theme]) : parsed[key];
  }
}

/** Parse and normalize the public account-settings mutation shape. */
export function parseAccountSettingsPatch(input: Record<string, unknown>): AccountSettingsPatch {
  const parsed = settingsPatchSchema.safeParse(input);
  if (!parsed.success) invalidSettings();

  const patch: AccountSettingsPatch = {};
  const keys: Array<keyof AccountSettings> = [
    "displayName",
    "timezone",
    "appearance",
    "notificationsEnabled",
    "soundEnabled",
    "focusDurationMinutes",
    "shortBreakDurationMinutes",
    "longBreakDurationMinutes",
    "longBreakInterval",
  ];

  for (const key of keys) {
    const value = patchValue(parsed.data, key);
    if (value === undefined) continue;
    if (key === "displayName") {
      patch.displayName = normalizeDisplayName(value as string);
    } else if (key === "timezone") {
      patch.timezone = validateTimezone(value as string);
    } else {
      patch[key] = value as never;
    }
  }

  if (Object.keys(patch).length === 0) invalidSettings();
  return patch;
}

export function validateAccountTimezoneOrDefault(value: string | undefined): string {
  return value === undefined ? DEFAULT_ACCOUNT_SETTINGS.timezone : validateTimezone(value);
}

export function settingsFromAccountInput(input: Partial<AccountSettings>): AccountSettings {
  const displayName = normalizeDisplayName(
    input.displayName ?? DEFAULT_ACCOUNT_SETTINGS.displayName,
  );
  const timezone = validateAccountTimezoneOrDefault(input.timezone);
  const appearance = input.appearance ?? DEFAULT_ACCOUNT_SETTINGS.appearance;
  const notificationsEnabled =
    input.notificationsEnabled ?? DEFAULT_ACCOUNT_SETTINGS.notificationsEnabled;
  const soundEnabled = input.soundEnabled ?? DEFAULT_ACCOUNT_SETTINGS.soundEnabled;
  const focusDurationMinutes =
    input.focusDurationMinutes ?? DEFAULT_ACCOUNT_SETTINGS.focusDurationMinutes;
  const shortBreakDurationMinutes =
    input.shortBreakDurationMinutes ?? DEFAULT_ACCOUNT_SETTINGS.shortBreakDurationMinutes;
  const longBreakDurationMinutes =
    input.longBreakDurationMinutes ?? DEFAULT_ACCOUNT_SETTINGS.longBreakDurationMinutes;
  const longBreakInterval = input.longBreakInterval ?? DEFAULT_ACCOUNT_SETTINGS.longBreakInterval;

  if (!appearanceSchema.safeParse(appearance).success) invalidSettings();
  for (const [key, value] of Object.entries({
    focusDurationMinutes,
    shortBreakDurationMinutes,
    longBreakDurationMinutes,
    longBreakInterval,
  }) as Array<[keyof typeof POMODORO_LIMITS, number]>) {
    const result = durationSchema(key).safeParse(value);
    if (!result.success) invalidSettings();
  }

  return {
    displayName,
    timezone,
    appearance: appearance as Appearance,
    notificationsEnabled,
    soundEnabled,
    focusDurationMinutes,
    shortBreakDurationMinutes,
    longBreakDurationMinutes,
    longBreakInterval,
  };
}
