import { eq } from "drizzle-orm";
import { type Database } from "@/server/db/client";
import { accounts, passwordCredentials, type Account } from "@/server/db/schema";
import { hashPassword, verifyPassword } from "./password";

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

export async function createAccount(
  db: Database,
  input: { email: string; now?: Date },
): Promise<Account> {
  const normalizedEmail = validateEmail(input.email);
  const now = input.now ?? new Date();
  const [account] = await db
    .insert(accounts)
    .values({
      email: input.email.trim(),
      normalizedEmail,
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  if (!account) {
    throw new Error("Account could not be created.");
  }

  return account;
}

export async function getAccountById(db: Database, accountId: string): Promise<Account | null> {
  const [account] = await db.select().from(accounts).where(eq(accounts.id, accountId)).limit(1);
  return account ?? null;
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

/** Verify against the stored Argon2id material without returning it to callers. */
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

  return credential ? verifyPassword(password, credential.passwordHash) : false;
}
