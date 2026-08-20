import { and, eq, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { accounts } from "@/server/db/schema";
import { getDatabase } from "@/server/db/client";
import { noStoreResponse, parseJsonObject } from "@/server/http/auth-route";
import { protectedRoute } from "@/server/http/authentication";
import { AppError } from "@/server/http/errors";
import { parseAccountSettingsPatch } from "@/server/modules/account/settings";
import { getSessionToken } from "@/server/modules/auth/cookies";
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

function isAccountPatchUnchanged(
  account: typeof accounts.$inferSelect,
  patch: Record<string, unknown>,
): boolean {
  return Object.entries(patch).every(([key, value]) => {
    if (!Object.prototype.hasOwnProperty.call(account, key)) return false;
    return account[key as keyof typeof account] === value;
  });
}

type AccountIdentities = Awaited<ReturnType<typeof listAccountOAuthIdentities>>;

export function accountPayload(
  account: typeof accounts.$inferSelect,
  identities: AccountIdentities = [],
  appearanceRevision?: string,
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
    appearanceRevision,
    appearanceIdentity: account.id,
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
  appearanceRevision?: string,
): Promise<NextResponse> {
  const identities = await listAccountOAuthIdentities(getDatabase(), account.id);
  return noStoreResponse({
    ok: true,
    account: accountPayload(account, identities, appearanceRevision),
  });
}

export async function GET(request: Request): Promise<NextResponse> {
  return protectedRoute(request, ({ account, accountVersion }) =>
    accountResponse(account, accountVersion),
  );
}

async function update(request: Request): Promise<NextResponse> {
  const operation = () =>
    protectedRoute(
      request,
      async ({ account, accountVersion }) => {
        const patch = parseAccountSettingsPatch(await parseJsonObject(request));
        const appearancePatch = Object.prototype.hasOwnProperty.call(patch, "appearance");
        const database = getDatabase();
        let updated: typeof accounts.$inferSelect | undefined;

        if (request.method === "PUT") {
          [updated] = await database.transaction(async (tx) => {
            await tx.execute(
              sql`SELECT pg_advisory_xact_lock(hashtext(CAST(${account.id} AS text)))`,
            );
            const [current] = await tx
              .select()
              .from(accounts)
              .where(eq(accounts.id, account.id))
              .for("update");
            if (!current || isAccountPatchUnchanged(current, patch)) {
              return current ? [current] : [];
            }
            if (appearancePatch) {
              const expectedRevision = Number.parseInt(accountVersion, 10);
              if (!Number.isSafeInteger(expectedRevision)) {
                throw new AppError("CONFLICT");
              }
              return tx
                .update(accounts)
                .set({
                  ...patch,
                  appearanceRevision: sql`${accounts.appearanceRevision} + 1`,
                  updatedAt: new Date(),
                })
                .where(
                  and(
                    eq(accounts.id, account.id),
                    eq(accounts.appearanceRevision, expectedRevision),
                  ),
                )
                .returning();
            }
            return tx
              .update(accounts)
              .set({ ...patch, updatedAt: new Date() })
              .where(eq(accounts.id, account.id))
              .returning();
          });
        } else if (appearancePatch) {
          const expectedRevision = Number.parseInt(accountVersion, 10);
          if (!Number.isSafeInteger(expectedRevision)) {
            throw new AppError("CONFLICT");
          }
          [updated] = await database.transaction(async (tx) => {
            await tx.execute(
              sql`SELECT pg_advisory_xact_lock(hashtext(CAST(${account.id} AS text)))`,
            );
            return tx
              .update(accounts)
              .set({
                ...patch,
                appearanceRevision: sql`${accounts.appearanceRevision} + 1`,
                updatedAt: new Date(),
              })
              .where(
                and(eq(accounts.id, account.id), eq(accounts.appearanceRevision, expectedRevision)),
              )
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
          if (appearancePatch) throw new AppError("CONFLICT");
          throw new Error("Account settings could not be saved.");
        }

        return accountResponse(updated, String(updated.appearanceRevision));
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
