import { createHash } from "node:crypto";
import { eq, getTableColumns, sql } from "drizzle-orm";
import { type Database } from "@/server/db/client";
import { accounts, passwordCredentials, type Account } from "@/server/db/schema";
import { settingsFromAccountInput, type AccountSettings } from "@/server/modules/account/settings";
import { hashPassword, verifyPasswordWithFallback } from "./password";

type AccountTransaction = Parameters<Parameters<Database["transaction"]>[0]>[0];
type AccountDatabase = Database | AccountTransaction;

const MAX_EMAIL_LENGTH = 320;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+$/;

/** Normalize only for identity comparisons; the original trimmed address is retained for display. */
export function normalizeEmail(email: string): string {
  return email.trim().normalize("NFKC").toLowerCase();
}

export function validateEmail(email: string): string {
  const trimmed = email.trim();
  const normalized = normalizeEmail(trimmed);
  if (
    trimmed.length === 0 ||
    trimmed.length > MAX_EMAIL_LENGTH ||
    normalized.length > MAX_EMAIL_LENGTH ||
    !EMAIL_PATTERN.test(normalized)
  ) {
    throw new Error("Email input is invalid.");
  }

  return normalized;
}

export async function lockEmailOwnership(
  db: AccountDatabase,
  normalizedEmail: string,
): Promise<void> {
  const digest = createHash("sha256")
    .update(`taskfella-account-email:${normalizedEmail}`, "utf8")
    .digest();
  await db.execute(
    sql`select pg_advisory_xact_lock(${digest.readInt32BE(0)}, ${digest.readInt32BE(4)})`,
  );
}

export async function createAccount(
  db: Database,
  input: { email: string; now?: Date } & Partial<AccountSettings>,
): Promise<Account> {
  const normalizedEmail = validateEmail(input.email);
  const now = input.now ?? new Date();
  const settings = settingsFromAccountInput(input);

  return db.transaction(async (tx) => {
    await lockEmailOwnership(tx, normalizedEmail);
    const [account] = await tx
      .insert(accounts)
      .values({
        email: input.email.trim(),
        normalizedEmail,
        displayName: settings.displayName,
        timezone: settings.timezone,
        appearance: settings.appearance,
        notificationsEnabled: settings.notificationsEnabled,
        soundEnabled: settings.soundEnabled,
        focusDurationMinutes: settings.focusDurationMinutes,
        shortBreakDurationMinutes: settings.shortBreakDurationMinutes,
        longBreakDurationMinutes: settings.longBreakDurationMinutes,
        longBreakInterval: settings.longBreakInterval,
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    if (!account) {
      throw new Error("Account could not be created.");
    }

    return account;
  });
}

export async function getAccountById(db: Database, accountId: string): Promise<Account | null> {
  const [account] = await db.select().from(accounts).where(eq(accounts.id, accountId)).limit(1);
  return account ?? null;
}

export async function getAccountWithVersion(
  db: Database,
  accountId: string,
): Promise<{ account: Account; version: string } | null> {
  const [row] = await db
    .select({
      ...getTableColumns(accounts),
      version: sql<string>`xmin::text`,
    })
    .from(accounts)
    .where(eq(accounts.id, accountId))
    .limit(1);
  if (!row) return null;
  const { version, ...account } = row;
  return { account, version };
}

export async function getAccountByNormalizedEmail(
  db: Database,
  normalizedEmail: string,
): Promise<Account | null> {
  const [account] = await db
    .select()
    .from(accounts)
    .where(eq(accounts.normalizedEmail, normalizedEmail))
    .limit(1);
  return account ?? null;
}

export function isUniqueConstraintViolation(error: unknown): boolean {
  if (typeof error !== "object" || error === null) {
    return false;
  }

  const candidate = error as { code?: unknown; cause?: unknown };
  return candidate.code === "23505" || isUniqueConstraintViolation(candidate.cause);
}

/** Persist a password hash without exposing the hash in the returned value. */
export async function setPasswordCredential(
  db: Database,
  accountId: string,
  password: string,
  now = new Date(),
): Promise<
  Pick<typeof passwordCredentials.$inferSelect, "id" | "accountId" | "createdAt" | "updatedAt">
> {
  const passwordHash = await hashPassword(password);
  const [credential] = await db
    .insert(passwordCredentials)
    .values({
      accountId,
      passwordHash,
      passwordChangedAt: now,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: passwordCredentials.accountId,
      set: {
        passwordHash,
        passwordChangedAt: now,
        updatedAt: now,
      },
    })
    .returning({
      id: passwordCredentials.id,
      accountId: passwordCredentials.accountId,
      createdAt: passwordCredentials.createdAt,
      updatedAt: passwordCredentials.updatedAt,
    });

  if (!credential) {
    throw new Error("Password credential could not be saved.");
  }

  return credential;
}

/** Verify against stored Argon2id material or a process-local fallback without returning it. */
export async function verifyAccountPassword(
  db: Database,
  accountId: string,
  password: string,
): Promise<boolean> {
  const [credential] = await db
    .select({ passwordHash: passwordCredentials.passwordHash })
    .from(passwordCredentials)
    .where(eq(passwordCredentials.accountId, accountId))
    .limit(1);

  return verifyPasswordWithFallback(password, credential?.passwordHash);
}
