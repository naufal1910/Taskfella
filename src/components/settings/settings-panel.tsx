"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  cacheAppearancePreference,
  clearAppearancePreferenceCache,
  compareAppearanceRevisions,
  currentAppearanceLifecycleGeneration,
  detectBrowserTimezone,
  isCurrentAppearanceLifecycle,
  notifyAppearanceChange,
  APPEARANCE_RESET_REVISION,
  beginAppearanceLifecycle,
  type AppearancePreference,
} from "@/components/theme/theme";
import { createAppearanceMutationTracker } from "@/shared/appearance-mutation";
import { enqueue } from "@/shared/async";
import { isValidTimezone } from "@/shared/timezone";

const POMODORO_LIMITS = {
  focusDurationMinutes: { min: 1, max: 120 },
  shortBreakDurationMinutes: { min: 1, max: 60 },
  longBreakDurationMinutes: { min: 1, max: 120 },
  longBreakInterval: { min: 1, max: 12 },
} as const;

interface AccountPayload {
  id: string;
  email: string;
  emailVerifiedAt: string | null;
  createdAt: string;
  updatedAt?: string;
  status: "verified" | "unverified";
  displayName?: string;
  timezone?: string;
  appearance?: AppearancePreference;
  appearanceRevision?: string;
  notificationsEnabled?: boolean;
  soundEnabled?: boolean;
  focusDurationMinutes?: number;
  shortBreakDurationMinutes?: number;
  longBreakDurationMinutes?: number;
  longBreakInterval?: number;
  settings?: {
    displayName?: string;
    timezone?: string;
    appearance?: AppearancePreference;
    notificationsEnabled?: boolean;
    soundEnabled?: boolean;
    pomodoro?: {
      focusDurationMinutes?: number;
      shortBreakDurationMinutes?: number;
      longBreakDurationMinutes?: number;
      longBreakInterval?: number;
    };
  };
  pomodoro?: {
    focusDurationMinutes?: number;
    shortBreakDurationMinutes?: number;
    longBreakDurationMinutes?: number;
    longBreakInterval?: number;
  };
}

type SettingsValues = {
  displayName: string;
  email: string;
  timezone: string;
  appearance: AppearancePreference;
  notificationsEnabled: boolean;
  soundEnabled: boolean;
  focusDurationMinutes: string;
  shortBreakDurationMinutes: string;
  longBreakDurationMinutes: string;
  longBreakInterval: string;
};

type FieldErrors = Partial<Record<keyof SettingsValues, string>>;
type Section = "profile" | "timezone" | "appearance" | "notifications" | "pomodoro";

interface ApiError {
  code?: string;
  message?: string;
}

function readAccountValue<T>(
  account: AccountPayload,
  key: "displayName" | "timezone" | "appearance" | "notificationsEnabled" | "soundEnabled",
  fallback: T,
): T {
  const value = account[key] ?? account.settings?.[key];
  return (value === undefined ? fallback : value) as T;
}

function valuesFromAccount(account: AccountPayload): SettingsValues {
  const pomodoro = account.pomodoro ?? account.settings?.pomodoro;
  return {
    displayName: readAccountValue(account, "displayName", ""),
    email: account.email,
    timezone: readAccountValue(account, "timezone", "UTC"),
    appearance: readAccountValue(account, "appearance", "system"),
    notificationsEnabled: readAccountValue(account, "notificationsEnabled", true),
    soundEnabled: readAccountValue(account, "soundEnabled", true),
    focusDurationMinutes: String(
      account.focusDurationMinutes ?? pomodoro?.focusDurationMinutes ?? 25,
    ),
    shortBreakDurationMinutes: String(
      account.shortBreakDurationMinutes ?? pomodoro?.shortBreakDurationMinutes ?? 5,
    ),
    longBreakDurationMinutes: String(
      account.longBreakDurationMinutes ?? pomodoro?.longBreakDurationMinutes ?? 15,
    ),
    longBreakInterval: String(account.longBreakInterval ?? pomodoro?.longBreakInterval ?? 4),
  };
}

const PATCHED_SETTINGS_KEYS = [
  "displayName",
  "timezone",
  "appearance",
  "notificationsEnabled",
  "soundEnabled",
  "focusDurationMinutes",
  "shortBreakDurationMinutes",
  "longBreakDurationMinutes",
  "longBreakInterval",
] as const satisfies readonly (keyof SettingsValues)[];

function patchValueMatchesCurrent(
  key: (typeof PATCHED_SETTINGS_KEYS)[number],
  submitted: unknown,
  current: SettingsValues,
): boolean {
  const currentValue = current[key];
  if (
    key === "focusDurationMinutes" ||
    key === "shortBreakDurationMinutes" ||
    key === "longBreakDurationMinutes" ||
    key === "longBreakInterval"
  ) {
    return String(submitted) === currentValue;
  }
  return submitted === currentValue;
}

function valuesAfterSave(
  current: SettingsValues,
  account: AccountPayload,
  patch: Record<string, unknown>,
): SettingsValues {
  const saved = valuesFromAccount(account);
  const next = { ...current };
  for (const key of PATCHED_SETTINGS_KEYS) {
    if (
      Object.prototype.hasOwnProperty.call(patch, key) &&
      patchValueMatchesCurrent(key, patch[key], current)
    ) {
      Object.assign(next, { [key]: saved[key] });
    }
  }
  return next;
}

function readCookie(name: string): string | undefined {
  const prefix = `${name}=`;
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

async function csrfToken(signal: AbortSignal): Promise<string> {
  const response = await fetch("/api/auth/csrf", {
    credentials: "same-origin",
    cache: "no-store",
    signal,
  });
  if (!response.ok) throw new Error("csrf");
  const token = readCookie("taskfella_csrf");
  if (!token) throw new Error("csrf");
  return token;
}

function errorText(error: unknown): string {
  if (error instanceof Error && error.message === "network") {
    return "We could not reach Taskfella. Check your connection and try again.";
  }
  return "We could not save these settings. Nothing was changed. Try again.";
}

function numberError(
  value: string,
  limits: { min: number; max: number },
  label: string,
): string | undefined {
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) return `${label} must be a whole number.`;
  if (parsed < limits.min || parsed > limits.max) {
    return `${label} must be between ${limits.min} and ${limits.max}.`;
  }
  return undefined;
}

function StatusMessage({ status, error }: { status?: string; error?: string }) {
  return (
    <div className="settings-feedback" aria-live="polite" aria-atomic="true">
      {status && <p className="feedback-success">{status}</p>}
      {error && (
        <p className="feedback-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

function SaveButton({ pending, label }: { pending: boolean; label: string }) {
  return (
    <button className="primary-action button-action" type="submit" disabled={pending}>
      {pending ? "Saving…" : label}
    </button>
  );
}

export function SettingsPanel() {
  const [account, setAccount] = useState<AccountPayload>();
  const [values, setValues] = useState<SettingsValues>();
  const [detectedTimezone] = useState<string | undefined>(() =>
    typeof window === "undefined" ? undefined : detectBrowserTimezone(),
  );
  const [pendingSections, setPendingSections] = useState<ReadonlySet<Section>>(() => new Set());
  const appearanceMutationTrackerRef = useRef(
    createAppearanceMutationTracker<AppearancePreference>(),
  );
  const appearanceSaveTailRef = useRef(Promise.resolve());
  const saveControllersRef = useRef(new Set<AbortController>());
  const savedAppearanceRevisionRef = useRef<string | undefined>(undefined);
  const savedAppearanceIdentityRef = useRef<string | undefined>(undefined);
  const savedAppearanceGenerationRef = useRef<number | undefined>(undefined);
  const [status, setStatus] = useState<string>();
  const [error, setError] = useState<string>();
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [unauthenticated, setUnauthenticated] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const mutationTracker = appearanceMutationTrackerRef.current;
    const saveControllers = saveControllersRef.current;
    return () => {
      mutationTracker.advance();
      for (const controller of saveControllers) controller.abort();
      const savedAppearance = mutationTracker.getSaved();
      if (savedAppearance) {
        const savedRevision = savedAppearanceRevisionRef.current;
        notifyAppearanceChange(
          savedAppearance,
          savedRevision,
          savedRevision === APPEARANCE_RESET_REVISION
            ? { generation: savedAppearanceGenerationRef.current, reset: true }
            : {
                authenticated: true,
                generation: savedAppearanceGenerationRef.current,
                identity: savedAppearanceIdentityRef.current,
              },
        );
      }
    };
  }, []);

  function setSectionPending(section: Section, pending: boolean): void {
    setPendingSections((current) => {
      const next = new Set(current);
      if (pending) next.add(section);
      else next.delete(section);
      return next;
    });
  }

  useEffect(() => {
    let active = true;
    const requestGeneration = beginAppearanceLifecycle();
    void fetch("/api/account", { credentials: "same-origin", cache: "no-store" })
      .then(async (response) => {
        if (!active) return;
        if (response.status === 401) {
          if (!isCurrentAppearanceLifecycle(requestGeneration)) return;
          clearAppearancePreferenceCache();
          appearanceMutationTrackerRef.current.recordSaved("system");
          savedAppearanceRevisionRef.current = APPEARANCE_RESET_REVISION;
          savedAppearanceIdentityRef.current = undefined;
          const generation = beginAppearanceLifecycle();
          savedAppearanceGenerationRef.current = generation;
          notifyAppearanceChange("system", APPEARANCE_RESET_REVISION, {
            generation,
            reset: true,
          });
          setUnauthenticated(true);
          return;
        }
        if (!response.ok) throw new Error("account");
        const payload = (await response.json()) as { account?: AccountPayload };
        if (!payload.account) throw new Error("account");
        if (!isCurrentAppearanceLifecycle(requestGeneration)) return;
        setAccount(payload.account);
        setValues(valuesFromAccount(payload.account));
        const preference = payload.account.appearance ?? "system";
        savedAppearanceRevisionRef.current = payload.account.appearanceRevision;
        savedAppearanceIdentityRef.current = payload.account.id;
        savedAppearanceGenerationRef.current = requestGeneration;
        appearanceMutationTrackerRef.current.recordSaved(preference);
        cacheAppearancePreference(
          preference,
          savedAppearanceRevisionRef.current,
          payload.account.id,
          requestGeneration,
        );
        notifyAppearanceChange(preference, savedAppearanceRevisionRef.current, {
          authenticated: true,
          generation: requestGeneration,
          identity: payload.account.id,
        });
      })
      .catch(() => {
        if (active) setError("We could not load your settings. Try again.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  function changeValue<K extends keyof SettingsValues>(key: K, value: SettingsValues[K]): void {
    if (key === "appearance") {
      appearanceMutationTrackerRef.current.advance();
      notifyAppearanceChange(value as AppearancePreference, undefined, {
        generation: currentAppearanceLifecycleGeneration(),
      });
    }
    setValues((current) => (current ? { ...current, [key]: value } : current));
    setStatus(undefined);
    setError(undefined);
    setFieldErrors((current) => ({ ...current, [key]: undefined }));
  }

  function invalidatePendingSaves(): void {
    appearanceMutationTrackerRef.current.advance();
    for (const controller of saveControllersRef.current) controller.abort();
  }

  async function save(section: Section, patch: Record<string, unknown>): Promise<void> {
    const appearancePatch = Object.prototype.hasOwnProperty.call(patch, "appearance");
    const requestGeneration = currentAppearanceLifecycleGeneration();
    const appearanceMutationId = appearancePatch
      ? appearanceMutationTrackerRef.current.advance()
      : appearanceMutationTrackerRef.current.current();
    setStatus(undefined);
    setError(undefined);
    const execute = async (): Promise<void> => {
      if (!isCurrentAppearanceLifecycle(requestGeneration)) return;
      if (
        appearancePatch &&
        appearanceMutationId !== undefined &&
        !appearanceMutationTrackerRef.current.isCurrent(appearanceMutationId)
      ) {
        return;
      }

      const controller = new AbortController();
      saveControllersRef.current.add(controller);
      setSectionPending(section, true);
      try {
        const response = await fetch("/api/account", {
          method: "PATCH",
          credentials: "same-origin",
          cache: "no-store",
          headers: {
            "content-type": "application/json",
            "x-csrf-token": await csrfToken(controller.signal),
          },
          signal: controller.signal,
          body: JSON.stringify(patch),
        });
        const payload = (await response.json().catch(() => ({}))) as {
          account?: AccountPayload;
          error?: ApiError;
        };
        if (controller.signal.aborted) return;
        if (!isCurrentAppearanceLifecycle(requestGeneration)) return;
        if (response.status === 401) {
          invalidatePendingSaves();
          clearAppearancePreferenceCache();
          appearanceMutationTrackerRef.current.recordSaved("system");
          savedAppearanceRevisionRef.current = APPEARANCE_RESET_REVISION;
          savedAppearanceIdentityRef.current = undefined;
          const generation = beginAppearanceLifecycle();
          savedAppearanceGenerationRef.current = generation;
          notifyAppearanceChange("system", APPEARANCE_RESET_REVISION, {
            generation,
            reset: true,
          });
          setUnauthenticated(true);
          return;
        }
        if (!response.ok || !payload.account) {
          if (payload.error?.code === "INVALID_REQUEST") {
            throw new Error("validation");
          }
          throw new Error("save");
        }
        setAccount(payload.account);
        setValues((current) =>
          current
            ? valuesAfterSave(current, payload.account!, patch)
            : valuesFromAccount(payload.account!),
        );
        setFieldErrors((current) => {
          const next = { ...current };
          for (const key of PATCHED_SETTINGS_KEYS) {
            if (Object.prototype.hasOwnProperty.call(patch, key)) delete next[key];
          }
          return next;
        });
        setStatus("Saved.");
        const mutationIsCurrent =
          appearanceMutationTrackerRef.current.isCurrent(appearanceMutationId);
        const appearanceHasUnsavedEdit =
          appearanceMutationTrackerRef.current.hasUnsaved() &&
          !(appearancePatch && mutationIsCurrent);
        if (appearancePatch || (mutationIsCurrent && !appearanceHasUnsavedEdit)) {
          const preference = payload.account.appearance ?? "system";
          const revision = payload.account.appearanceRevision;
          const savedRevision = savedAppearanceRevisionRef.current;
          const responseIsOlder =
            revision !== undefined &&
            savedRevision !== undefined &&
            compareAppearanceRevisions(revision, savedRevision) < 0;
          if (responseIsOlder) {
            const savedAppearance = appearanceMutationTrackerRef.current.getSaved();
            if (savedAppearance) {
              cacheAppearancePreference(
                savedAppearance,
                savedRevision,
                savedAppearanceIdentityRef.current,
                requestGeneration,
              );
            }
          } else {
            appearanceMutationTrackerRef.current.recordSaved(preference, appearanceMutationId);
            savedAppearanceRevisionRef.current = revision ?? savedRevision;
            savedAppearanceIdentityRef.current = payload.account.id;
            savedAppearanceGenerationRef.current = requestGeneration;
            if (!appearanceHasUnsavedEdit) {
              cacheAppearancePreference(
                preference,
                savedAppearanceRevisionRef.current,
                payload.account.id,
                requestGeneration,
              );
              if (mutationIsCurrent) {
                notifyAppearanceChange(preference, savedAppearanceRevisionRef.current, {
                  authenticated: true,
                  generation: requestGeneration,
                  identity: payload.account.id,
                });
              }
            }
          }
        }
      } catch (caught) {
        if (controller.signal.aborted) return;
        setError(
          caught instanceof Error && caught.message === "validation"
            ? "Check the highlighted values and try again."
            : errorText(caught),
        );
      } finally {
        saveControllersRef.current.delete(controller);
        setSectionPending(section, false);
      }
    };

    if (appearancePatch) {
      const queued = enqueue(appearanceSaveTailRef.current, execute);
      appearanceSaveTailRef.current = queued.tail;
      await queued.result;
    } else {
      await execute();
    }
  }

  if (loading) {
    return (
      <p className="settings-loading" aria-busy="true" aria-live="polite">
        Loading your settings…
      </p>
    );
  }

  if (unauthenticated) {
    return (
      <section className="settings-empty" aria-labelledby="settings-signed-out-title">
        <p className="eyebrow">Account settings</p>
        <h2 id="settings-signed-out-title">You are signed out.</h2>
        <p>Sign in to manage the preferences associated with your account.</p>
        <Link className="primary-action" href="/login">
          Sign in
        </Link>
      </section>
    );
  }

  if (!account || !values) {
    return (
      <section className="settings-empty" role="alert" aria-labelledby="settings-error-title">
        <p className="eyebrow">Account settings</p>
        <h2 id="settings-error-title">We could not load your settings.</h2>
        <p>{error ?? "Try again without exposing account details."}</p>
        <button
          className="primary-action button-action"
          type="button"
          onClick={() => window.location.reload()}
        >
          Try again
        </button>
      </section>
    );
  }

  const timezoneError = fieldErrors.timezone;
  const pomodoroFields: Array<{
    key: keyof Pick<
      SettingsValues,
      | "focusDurationMinutes"
      | "shortBreakDurationMinutes"
      | "longBreakDurationMinutes"
      | "longBreakInterval"
    >;
    label: string;
    help: string;
    limitKey: keyof typeof POMODORO_LIMITS;
  }> = [
    {
      key: "focusDurationMinutes",
      label: "Focus duration",
      help: "The target for new focus sessions.",
      limitKey: "focusDurationMinutes",
    },
    {
      key: "shortBreakDurationMinutes",
      label: "Short break",
      help: "The default short break after a focus session.",
      limitKey: "shortBreakDurationMinutes",
    },
    {
      key: "longBreakDurationMinutes",
      label: "Long break",
      help: "The default long break after the configured interval.",
      limitKey: "longBreakDurationMinutes",
    },
    {
      key: "longBreakInterval",
      label: "Long break after",
      help: "Completed focus sessions before a long break.",
      limitKey: "longBreakInterval",
    },
  ];

  return (
    <div className="settings-content">
      <StatusMessage status={status} error={error} />

      <section className="settings-section ui-surface" aria-labelledby="settings-account-title">
        <div className="settings-section-heading">
          <div>
            <p className="eyebrow">Account</p>
            <h2 id="settings-account-title">Your profile</h2>
          </div>
          <span className="settings-section-number" aria-hidden="true">
            01
          </span>
        </div>
        <p className="settings-description">
          Keep the name Taskfella uses for your personal workspace. Your sign-in address remains a
          verified account identity.
        </p>
        <form
          className="settings-form"
          onSubmit={(event) => {
            event.preventDefault();
            void save("profile", { displayName: values.displayName });
          }}
        >
          <label className="field">
            <span>Display name</span>
            <input
              type="text"
              name="displayName"
              value={values.displayName}
              maxLength={80}
              autoComplete="name"
              onChange={(event) => changeValue("displayName", event.target.value)}
              aria-describedby="display-name-help"
            />
            <small id="display-name-help">Optional, up to 80 characters.</small>
          </label>
          <label className="field">
            <span>Email address</span>
            <input
              type="email"
              value={values.email}
              readOnly
              aria-describedby="email-settings-help"
            />
            <small id="email-settings-help">Email changes require a separate verified flow.</small>
          </label>
          <div className="settings-actions">
            <SaveButton pending={pendingSections.has("profile")} label="Save profile" />
          </div>
        </form>
      </section>

      <section className="settings-section ui-surface" aria-labelledby="settings-timezone-title">
        <div className="settings-section-heading">
          <div>
            <p className="eyebrow">Timezone</p>
            <h2 id="settings-timezone-title">Use your local day</h2>
          </div>
          <span className="settings-section-number" aria-hidden="true">
            02
          </span>
        </div>
        <p className="settings-description">
          Today boundaries, due dates, manual time, and analytics use this saved timezone.
          Historical timestamps remain unchanged when you edit it.
        </p>
        <form
          className="settings-form"
          onSubmit={(event) => {
            event.preventDefault();
            if (!isValidTimezone(values.timezone)) {
              setFieldErrors((current) => ({
                ...current,
                timezone: "Enter a valid IANA timezone identifier.",
              }));
              setError("Check the timezone and try again.");
              return;
            }
            void save("timezone", { timezone: values.timezone });
          }}
        >
          <label className="field">
            <span>Account timezone</span>
            <input
              type="text"
              name="timezone"
              value={values.timezone}
              list="taskfella-timezone-options"
              autoComplete="off"
              spellCheck={false}
              aria-invalid={timezoneError ? "true" : undefined}
              aria-describedby={["timezone-help", timezoneError ? "timezone-error" : undefined]
                .filter(Boolean)
                .join(" ")}
              onChange={(event) => changeValue("timezone", event.target.value)}
            />
            <small id="timezone-help">
              Use an IANA value such as America/New_York or Europe/London.
            </small>
            {timezoneError && (
              <small id="timezone-error" className="field-error">
                {timezoneError}
              </small>
            )}
          </label>
          {detectedTimezone && detectedTimezone !== values.timezone && (
            <div className="settings-suggestion" role="status">
              <p>
                This browser reports <strong>{detectedTimezone}</strong>. The saved account timezone
                stays authoritative until you choose to change it.
              </p>
              <button
                className="secondary-action"
                type="button"
                onClick={() => changeValue("timezone", detectedTimezone)}
              >
                Use detected timezone
              </button>
            </div>
          )}
          <datalist id="taskfella-timezone-options">
            <option value="UTC" />
            <option value="America/Los_Angeles" />
            <option value="America/Chicago" />
            <option value="America/New_York" />
            <option value="Europe/London" />
            <option value="Europe/Berlin" />
            <option value="Asia/Singapore" />
            <option value="Asia/Tokyo" />
            <option value="Australia/Sydney" />
          </datalist>
          <div className="settings-actions">
            <SaveButton pending={pendingSections.has("timezone")} label="Save timezone" />
          </div>
        </form>
      </section>

      <section className="settings-section ui-surface" aria-labelledby="settings-appearance-title">
        <div className="settings-section-heading">
          <div>
            <p className="eyebrow">Appearance</p>
            <h2 id="settings-appearance-title">Choose your atmosphere</h2>
          </div>
          <span className="settings-section-number" aria-hidden="true">
            03
          </span>
        </div>
        <p className="settings-description">
          System follows this device. Light and Dark stay consistent across authentication,
          settings, and future workspace routes.
        </p>
        <form
          className="settings-form"
          onSubmit={(event) => {
            event.preventDefault();
            void save("appearance", { appearance: values.appearance });
          }}
        >
          <fieldset className="choice-group">
            <legend className="sr-only">Appearance preference</legend>
            {(
              [
                ["system", "System", "Follow this device's light or dark preference."],
                ["light", "Light", "Use warm paper and clear surfaces."],
                ["dark", "Dark", "Use the dark canvas and preserved contrast."],
              ] as const
            ).map(([value, label, description]) => (
              <label className="choice-card" key={value}>
                <input
                  type="radio"
                  name="appearance"
                  value={value}
                  checked={values.appearance === value}
                  onChange={() => changeValue("appearance", value)}
                />
                <span className="choice-card-copy">
                  <strong>{label}</strong>
                  <small>{description}</small>
                </span>
              </label>
            ))}
          </fieldset>
          <div className="settings-actions">
            <SaveButton pending={pendingSections.has("appearance")} label="Save appearance" />
          </div>
        </form>
      </section>

      <section
        className="settings-section ui-surface"
        aria-labelledby="settings-notifications-title"
      >
        <div className="settings-section-heading">
          <div>
            <p className="eyebrow">Notifications</p>
            <h2 id="settings-notifications-title">Stay gently informed</h2>
          </div>
          <span className="settings-section-number" aria-hidden="true">
            04
          </span>
        </div>
        <p className="settings-description">
          Notifications are contextual. Taskfella will not request browser permission just for
          opening settings.
        </p>
        <form
          className="settings-form"
          onSubmit={(event) => {
            event.preventDefault();
            void save("notifications", { notificationsEnabled: values.notificationsEnabled });
          }}
        >
          <label className="toggle-row">
            <input
              type="checkbox"
              checked={values.notificationsEnabled}
              onChange={(event) => changeValue("notificationsEnabled", event.target.checked)}
            />
            <span>
              <strong>Enable focus and break notifications</strong>
              <small>
                Allow in-app and supported browser notifications when a timer event needs attention.
              </small>
            </span>
          </label>
          <div className="settings-actions">
            <SaveButton pending={pendingSections.has("notifications")} label="Save notifications" />
          </div>
        </form>
      </section>

      <section className="settings-section ui-surface" aria-labelledby="settings-pomodoro-title">
        <div className="settings-section-heading">
          <div>
            <p className="eyebrow">Pomodoro</p>
            <h2 id="settings-pomodoro-title">Set a calm rhythm</h2>
          </div>
          <span className="settings-section-number" aria-hidden="true">
            05
          </span>
        </div>
        <p className="settings-description">
          These values affect new sessions only. A running focus session keeps the target it started
          with and can continue into overtime.
        </p>
        <form
          className="settings-form"
          onSubmit={(event) => {
            event.preventDefault();
            const nextErrors: FieldErrors = {};
            for (const field of pomodoroFields) {
              const message = numberError(
                values[field.key],
                POMODORO_LIMITS[field.limitKey],
                field.label,
              );
              if (message) nextErrors[field.key] = message;
            }
            if (Object.keys(nextErrors).length > 0) {
              setFieldErrors(nextErrors);
              setError("Check the highlighted Pomodoro values and try again.");
              return;
            }
            void save("pomodoro", {
              focusDurationMinutes: Number(values.focusDurationMinutes),
              shortBreakDurationMinutes: Number(values.shortBreakDurationMinutes),
              longBreakDurationMinutes: Number(values.longBreakDurationMinutes),
              longBreakInterval: Number(values.longBreakInterval),
              soundEnabled: values.soundEnabled,
            });
          }}
        >
          <div className="settings-number-grid">
            {pomodoroFields.map((field) => {
              const errorId = `${field.key}-error`;
              return (
                <label className="field" key={field.key}>
                  <span>{field.label}</span>
                  <div className="number-input-wrap">
                    <input
                      type="number"
                      name={field.key}
                      value={values[field.key]}
                      min={POMODORO_LIMITS[field.limitKey].min}
                      max={POMODORO_LIMITS[field.limitKey].max}
                      step={1}
                      inputMode="numeric"
                      aria-invalid={fieldErrors[field.key] ? "true" : undefined}
                      aria-describedby={[
                        `${field.key}-help`,
                        fieldErrors[field.key] ? errorId : undefined,
                      ]
                        .filter(Boolean)
                        .join(" ")}
                      onChange={(event) => changeValue(field.key, event.target.value)}
                    />
                    <span aria-hidden="true">
                      {field.key === "longBreakInterval" ? "sessions" : "minutes"}
                    </span>
                  </div>
                  <small id={`${field.key}-help`}>
                    {field.help} Allowed: {POMODORO_LIMITS[field.limitKey].min}–
                    {POMODORO_LIMITS[field.limitKey].max}.
                  </small>
                  {fieldErrors[field.key] && (
                    <small id={errorId} className="field-error">
                      {fieldErrors[field.key]}
                    </small>
                  )}
                </label>
              );
            })}
          </div>
          <label className="toggle-row">
            <input
              type="checkbox"
              checked={values.soundEnabled}
              onChange={(event) => changeValue("soundEnabled", event.target.checked)}
            />
            <span>
              <strong>Play timer sounds</strong>
              <small>
                Use the built-in sound for focus and break notifications when supported.
              </small>
            </span>
          </label>
          <div className="settings-actions">
            <SaveButton pending={pendingSections.has("pomodoro")} label="Save Pomodoro settings" />
          </div>
        </form>
      </section>

      <p className="settings-note">
        Preferences are saved to your account and restored on your next session. Need to leave?{" "}
        <Link href="/logout">Sign out securely</Link>.
      </p>
    </div>
  );
}
