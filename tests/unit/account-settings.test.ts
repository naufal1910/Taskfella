import { describe, expect, it } from "vitest";
import { AppError } from "@/server/http/errors";
import { parseSignupInput } from "@/server/modules/auth/input";
import {
  DEFAULT_ACCOUNT_SETTINGS,
  POMODORO_LIMITS,
  isValidTimezone,
  parseAccountSettingsPatch,
  settingsFromAccountInput,
} from "@/server/modules/account/settings";

function invalid(input: Record<string, unknown>): AppError {
  try {
    parseAccountSettingsPatch(input);
  } catch (error) {
    expect(error).toBeInstanceOf(AppError);
    return error as AppError;
  }
  throw new Error("expected invalid settings");
}

describe("account settings validation", () => {
  it("uses safe defaults and accepts named IANA timezones", () => {
    expect(settingsFromAccountInput({})).toEqual(DEFAULT_ACCOUNT_SETTINGS);
    expect(isValidTimezone("America/New_York")).toBe(true);
    expect(isValidTimezone("not/a-real-timezone")).toBe(false);
    expect(isValidTimezone("+05:30")).toBe(false);
    expect(isValidTimezone("UTC")).toBe(true);
  });

  it("keeps the browser-provided signup timezone as the initial account value", () => {
    expect(
      parseSignupInput({
        email: "person@example.test",
        password: "a sufficiently long passphrase",
        timezone: "Asia/Singapore",
      }),
    ).toEqual({
      email: "person@example.test",
      password: "a sufficiently long passphrase",
      timezone: "Asia/Singapore",
    });
  });

  it("normalizes the approved nested settings shape", () => {
    expect(
      parseAccountSettingsPatch({
        profile: { displayName: "  Ada  " },
        timezone: "Europe/London",
        appearance: "dark",
        notifications: false,
        sound: false,
        pomodoro: {
          focusDuration: 50,
          shortBreakDuration: 10,
          longBreakDuration: 30,
          longBreakAfter: 3,
        },
      }),
    ).toEqual({
      displayName: "Ada",
      timezone: "Europe/London",
      appearance: "dark",
      notificationsEnabled: false,
      soundEnabled: false,
      focusDurationMinutes: 50,
      shortBreakDurationMinutes: 10,
      longBreakDurationMinutes: 30,
      longBreakInterval: 3,
    });
  });

  it("rejects every Pomodoro boundary and malformed input", () => {
    for (const [key, limits] of Object.entries(POMODORO_LIMITS)) {
      expect(invalid({ [key]: limits.min - 1 }).code).toBe("INVALID_REQUEST");
      expect(invalid({ [key]: limits.max + 1 }).code).toBe("INVALID_REQUEST");
      expect(invalid({ [key]: "25" }).code).toBe("INVALID_REQUEST");
    }
    expect(invalid({ timezone: "Not/AZone" }).code).toBe("INVALID_REQUEST");
    expect(invalid({ timezone: "" }).code).toBe("INVALID_REQUEST");
    expect(invalid({ appearance: "sepia" }).code).toBe("INVALID_REQUEST");
    expect(invalid({ notificationsEnabled: "yes" }).code).toBe("INVALID_REQUEST");
    expect(invalid({ unknown: true }).code).toBe("INVALID_REQUEST");
    expect(invalid({}).code).toBe("INVALID_REQUEST");
  });

  it("does not accept conflicting aliases", () => {
    expect(invalid({ displayName: "One", name: "Two" }).code).toBe("INVALID_REQUEST");
    expect(
      invalid({
        pomodoro: { focusDuration: 25 },
        focusDurationMinutes: 30,
      }).code,
    ).toBe("INVALID_REQUEST");
  });
});
