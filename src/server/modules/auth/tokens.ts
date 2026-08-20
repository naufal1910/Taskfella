import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { and, eq, gt, isNull } from "drizzle-orm";
import {
  emailVerificationTokens,
  passwordResetTokens,
  type EmailVerificationToken,
  type PasswordResetToken,
} from "@/server/db/schema";
import { type Database } from "@/server/db/client";

export const EMAIL_VERIFICATION_TOKEN_TTL_MS = 24 * 60 * 60 * 1000;
export const PASSWORD_RESET_TOKEN_TTL_MS = 60 * 60 * 1000;
const TOKEN_BYTES = 32;

export interface IssuedToken {
  id: string;
  accountId: string;
  token: string;
  expiresAt: Date;
}

export interface ConsumedToken {
  id: string;
  accountId: string;
}

/** Generate a high-entropy bearer value for delivery through a trusted flow. */
export function generateOpaqueToken(): string {
  return randomBytes(TOKEN_BYTES).toString("base64url");
}

/**
 * Hash bearer values before they cross the database boundary. A random 256-bit
 * token makes an unsalted SHA-256 digest appropriate here: the digest is only a
 * lookup value and the token cannot feasibly be enumerated.
 */
export function hashBearerToken(token: string): string {
  if (typeof token !== "string" || token.length === 0 || token.length > 512) {
    throw new Error("Bearer token input is invalid.");
  }

  return createHash("sha256").update(token, "utf8").digest("hex");
}

/** Constant-time comparison for already-hashed values. */
export function safeHashEquals(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left, "utf8");
  const rightBuffer = Buffer.from(right, "utf8");
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

function getExpiry(now: Date, ttlMs: number): Date {
  if (!Number.isFinite(ttlMs) || ttlMs <= 0) {
    throw new Error("Token expiry must be positive.");
  }

  return new Date(now.getTime() + ttlMs);
}

function validateTokenDates(now: Date, expiresAt: Date): void {
  if (
    !Number.isFinite(now.getTime()) ||
    !Number.isFinite(expiresAt.getTime()) ||
    expiresAt <= now
  ) {
    throw new Error("Token expiry must be in the future.");
  }
}

export async function createEmailVerificationToken(
  db: Database,
  accountId: string,
  options: { now?: Date; ttlMs?: number } = {},
): Promise<IssuedToken> {
  const now = options.now ?? new Date();
  const expiresAt = getExpiry(now, options.ttlMs ?? EMAIL_VERIFICATION_TOKEN_TTL_MS);
  validateTokenDates(now, expiresAt);
  const token = generateOpaqueToken();
  const [row] = await db
    .insert(emailVerificationTokens)
    .values({
      accountId,
      tokenHash: hashBearerToken(token),
      expiresAt,
      createdAt: now,
    })
    .returning({ id: emailVerificationTokens.id, accountId: emailVerificationTokens.accountId });

  if (!row) {
    throw new Error("Email verification token could not be created.");
  }

  return { ...row, token, expiresAt };
}

export async function consumeEmailVerificationToken(
  db: Database,
  token: string,
  now = new Date(),
): Promise<ConsumedToken | null> {
  let tokenHash: string;
  try {
    tokenHash = hashBearerToken(token);
  } catch {
    return null;
  }

  const [row] = await db
    .update(emailVerificationTokens)
    .set({ consumedAt: now })
    .where(
      and(
        eq(emailVerificationTokens.tokenHash, tokenHash),
        isNull(emailVerificationTokens.consumedAt),
        isNull(emailVerificationTokens.invalidatedAt),
        gt(emailVerificationTokens.expiresAt, now),
      ),
    )
    .returning({ id: emailVerificationTokens.id, accountId: emailVerificationTokens.accountId });

  return row ?? null;
}

export async function createPasswordResetToken(
  db: Database,
  accountId: string,
  options: { now?: Date; ttlMs?: number } = {},
): Promise<IssuedToken> {
  const now = options.now ?? new Date();
  const expiresAt = getExpiry(now, options.ttlMs ?? PASSWORD_RESET_TOKEN_TTL_MS);
  validateTokenDates(now, expiresAt);
  const token = generateOpaqueToken();
  const [row] = await db
    .insert(passwordResetTokens)
    .values({
      accountId,
      tokenHash: hashBearerToken(token),
      expiresAt,
      createdAt: now,
    })
    .returning({ id: passwordResetTokens.id, accountId: passwordResetTokens.accountId });

  if (!row) {
    throw new Error("Password reset token could not be created.");
  }

  return { ...row, token, expiresAt };
}

export async function consumePasswordResetToken(
  db: Database,
  token: string,
  now = new Date(),
): Promise<ConsumedToken | null> {
  let tokenHash: string;
  try {
    tokenHash = hashBearerToken(token);
  } catch {
    return null;
  }

  const [row] = await db
    .update(passwordResetTokens)
    .set({ consumedAt: now })
    .where(
      and(
        eq(passwordResetTokens.tokenHash, tokenHash),
        isNull(passwordResetTokens.consumedAt),
        isNull(passwordResetTokens.invalidatedAt),
        gt(passwordResetTokens.expiresAt, now),
      ),
    )
    .returning({ id: passwordResetTokens.id, accountId: passwordResetTokens.accountId });

  return row ?? null;
}

export type StoredEmailVerificationToken = EmailVerificationToken;
export type StoredPasswordResetToken = PasswordResetToken;
