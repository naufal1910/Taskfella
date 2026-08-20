import { eq, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { accounts } from "@/server/db/schema";
import { parseAccountSettingsPatch } from "@/server/modules/account/settings";
import { getDatabase } from "@/server/db/client";
import { noStoreResponse, parseJsonObject } from "@/server/http/auth-route";
import { protectedRoute } from "@/server/http/authentication";
import { getSessionToken, setAppearanceCookie } from "@/server/modules/auth/cookies";
import { listAccountOAuthIdentities } from "@/server/modules/auth/identities";
import { enqueue } from "@/shared/async";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const revalidate = 0;

const settingsMutationTails = new Map<string, Promise<void>>();

async function serializeSettingsMutation<T>(key: string, operation: () => Promise<T>): Promise<T> {
  const queued = enqueue(settingsMutationTails.get(key) ?? Promise.resolve(), operation);
  settingsMutationTails.set(key, queued.tail);
  try {
    return await queued.result;
  } finally {
    if (settingsMutationTails.get(key) === queued.tail) {
      settingsMutationTails.delete(key);
    }
  }
}

type AccountIdentities = Awaited<ReturnType<typeof listAccountOAuthIdentities>>;

export function accountPayload(
  account: typeof accounts.$inferSelect,
  identities: AccountIdentities = [],
) {
  const pomodoro = {
    focusDurationMinutes: account.focusDurationMinutes,
    shortBreakDurationMinutes: account.shortBreakDurationMinutes,
    longBreakDurationMinutes: account.longBreakDurationMinutes,
    longBreakInterval: account.longBreakInterval,
  };

  return {
    id: account.id,
    email: account.email,
    emailVerifiedAt: account.emailVerifiedAt,
    createdAt: account.createdAt,
    updatedAt: account.updatedAt,
    status: account.emailVerifiedAt ? "verified" : "unverified",
    identities,
    displayName: account.displayName,
    name: account.displayName,
    timezone: account.timezone,
    appearance: account.appearance,
    theme: account.appearance,
    notificationsEnabled: account.notificationsEnabled,
    notifications: account.notificationsEnabled,
    soundEnabled: account.soundEnabled,
    sound: account.soundEnabled,
    focusDurationMinutes: account.focusDurationMinutes,
    shortBreakDurationMinutes: account.shortBreakDurationMinutes,
    longBreakDurationMinutes: account.longBreakDurationMinutes,
    longBreakInterval: account.longBreakInterval,
    settings: {
      displayName: account.displayName,
      name: account.displayName,
      timezone: account.timezone,
      appearance: account.appearance,
      theme: account.appearance,
      notificationsEnabled: account.notificationsEnabled,
      notifications: account.notificationsEnabled,
      soundEnabled: account.soundEnabled,
      sound: account.soundEnabled,
      pomodoro,
    },
    pomodoro: {
      ...pomodoro,
      focusDuration: pomodoro.focusDurationMinutes,
      shortBreak: pomodoro.shortBreakDurationMinutes,
      longBreak: pomodoro.longBreakDurationMinutes,
      longBreakAfter: pomodoro.longBreakInterval,
    },
  };
}

async function accountResponse(
  account: typeof accounts.$inferSelect,
  options: { syncAppearanceCookie?: boolean } = {},
): Promise<NextResponse> {
  const identities = await listAccountOAuthIdentities(getDatabase(), account.id);
  const response = noStoreResponse({ ok: true, account: accountPayload(account, identities) });
  if (options.syncAppearanceCookie !== false) {
    setAppearanceCookie(response, account.appearance as "system" | "light" | "dark");
  }
  return response;
}

export async function GET(request: Request): Promise<NextResponse> {
  return protectedRoute(request, ({ account }) => accountResponse(account));
}

async function update(request: Request): Promise<NextResponse> {
  const operation = () =>
    protectedRoute(
      request,
      async ({ account }) => {
        const patch = parseAccountSettingsPatch(await parseJsonObject(request));
        const appearancePatch = Object.prototype.hasOwnProperty.call(patch, "appearance");
        const database = getDatabase();
        let updated: typeof accounts.$inferSelect | undefined;
        if (appearancePatch) {
          [updated] = await database.transaction(async (tx) => {
            await tx.execute(
              sql`SELECT pg_advisory_xact_lock(hashtext(CAST(${account.id} AS text)))`,
            );
            return tx
              .update(accounts)
              .set({ ...patch, updatedAt: new Date() })
              .where(eq(accounts.id, account.id))
              .returning();
          });
        } else {
          [updated] = await database
            .update(accounts)
            .set({ ...patch, updatedAt: new Date() })
            .where(eq(accounts.id, account.id))
            .returning();
        }

        if (!updated) {
          throw new Error("Account settings could not be saved.");
        }

        return accountResponse(updated, { syncAppearanceCookie: appearancePatch });
      },
      { mutation: true },
    );
  const sessionToken = getSessionToken(request);
  return sessionToken ? serializeSettingsMutation(sessionToken, operation) : operation();
}

export async function PATCH(request: Request): Promise<NextResponse> {
  return update(request);
}

/** PUT is accepted as an idempotent compatibility alias for settings clients. */
export async function PUT(request: Request): Promise<NextResponse> {
  return update(request);
}
