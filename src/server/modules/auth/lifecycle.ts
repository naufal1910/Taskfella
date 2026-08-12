import { and, eq, gt, isNull } from "drizzle-orm";
import { type Database } from "@/server/db/client";
import {
  accounts,
  emailVerificationTokens,
  passwordCredentials,
  passwordResetTokens,
  sessions,
  type Account,
} from "@/server/db/schema";
import {
  EMAIL_VERIFICATION_TOKEN_TTL_MS,
  generateOpaqueToken,
  hashBearerToken,
  PASSWORD_RESET_TOKEN_TTL_MS,
  type IssuedToken,
} from "./tokens";
import { hashPassword, validatePasswordInput, verifyPasswordWithFallback } from "./password";
import { normalizeEmail, validateEmail } from "./accounts";
import { SESSION_TTL_MS } from "./sessions";

export type OneTimeTokenState = "valid" | "invalid" | "expired" | "already-used" | "superseded";

export type VerificationOutcome =
  | { state: "verified"; accountId: string }
  | { state: "already-verified"; accountId: string }
  | { state: Exclude<OneTimeTokenState, "valid"> };

export interface SignupResult {
  account: Account;
  verification: IssuedToken;
}

export type LoginResult =
  | { state: "invalid-credentials" }
  | { state: "unverified"; account: Account }
  | { state: "authenticated"; account: Account; token: string; expiresAt: Date };

function expiryFrom(now: Date, ttlMs: number): Date {
  if (!Number.isFinite(now.getTime()) || !Number.isFinite(ttlMs) || ttlMs <= 0) {
    throw new Error("Token expiry must be positive.");
  }
  return new Date(now.getTime() + ttlMs);
}

function tokenState(
  row: {
    expiresAt: Date;
    consumedAt: Date | null;
    invalidatedAt: Date | null;
  },
  now: Date,
): OneTimeTokenState {
  if (row.invalidatedAt) {
    return "superseded";
  }
  if (row.consumedAt) {
    return "already-used";
  }
  if (row.expiresAt.getTime() <= now.getTime()) {
    return "expired";
  }
  return "valid";
}

function hashTokenOrNull(token: string): string | null {
  try {
    return hashBearerToken(token);
  } catch {
    return null;
  }
}

export async function createAccountWithPasswordAndVerification(
  db: Database,
  input: { email: string; password: string; now?: Date },
): Promise<SignupResult> {
  const normalizedEmail = validateEmail(input.email);
  validatePasswordInput(input.password);
  const passwordHash = await hashPassword(input.password);
  const now = input.now ?? new Date();
  const verificationToken = generateOpaqueToken();
  const expiresAt = expiryFrom(now, EMAIL_VERIFICATION_TOKEN_TTL_MS);

  return db.transaction(async (tx) => {
    const [account] = await tx
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

    await tx.insert(passwordCredentials).values({
      accountId: account.id,
      passwordHash,
      passwordChangedAt: now,
      createdAt: now,
      updatedAt: now,
    });

    const [token] = await tx
      .insert(emailVerificationTokens)
      .values({
        accountId: account.id,
        tokenHash: hashBearerToken(verificationToken),
        expiresAt,
        createdAt: now,
      })
      .returning({ id: emailVerificationTokens.id, accountId: emailVerificationTokens.accountId });

    if (!token) {
      throw new Error("Verification token could not be created.");
    }

    return {
      account,
      verification: { ...token, token: verificationToken, expiresAt },
    };
  });
}

export async function issueVerificationToken(
  db: Database,
  accountId: string,
  options: { now?: Date; ttlMs?: number } = {},
): Promise<{ account: Account; verification: IssuedToken } | null> {
  const now = options.now ?? new Date();
  const expiresAt = expiryFrom(now, options.ttlMs ?? EMAIL_VERIFICATION_TOKEN_TTL_MS);
  const token = generateOpaqueToken();

  return db.transaction(async (tx) => {
    const [account] = await tx
      .select()
      .from(accounts)
      .where(eq(accounts.id, accountId))
      .for("update");
    if (!account || account.emailVerifiedAt) {
      return null;
    }

    await tx
      .update(emailVerificationTokens)
      .set({ invalidatedAt: now })
      .where(
        and(
          eq(emailVerificationTokens.accountId, accountId),
          isNull(emailVerificationTokens.consumedAt),
          isNull(emailVerificationTokens.invalidatedAt),
        ),
      );

    const [created] = await tx
      .insert(emailVerificationTokens)
      .values({
        accountId,
        tokenHash: hashBearerToken(token),
        expiresAt,
        createdAt: now,
      })
      .returning({ id: emailVerificationTokens.id, accountId: emailVerificationTokens.accountId });

    if (!created) {
      throw new Error("Verification token could not be created.");
    }

    return { account, verification: { ...created, token, expiresAt } };
  });
}

export async function authenticateAndIssueSession(
  db: Database,
  input: { email: string; password: string; presentedToken?: string; now?: Date },
): Promise<LoginResult> {
  const normalizedEmail = validateEmail(input.email);
  const now = input.now ?? new Date();

  return db.transaction(async (tx): Promise<LoginResult> => {
    const [account] = await tx
      .select()
      .from(accounts)
      .where(eq(accounts.normalizedEmail, normalizedEmail))
      .for("update");
    const [credential] = account
      ? await tx
          .select({ passwordHash: passwordCredentials.passwordHash })
          .from(passwordCredentials)
          .where(eq(passwordCredentials.accountId, account.id))
          .limit(1)
      : [];
    const validPassword = await verifyPasswordWithFallback(input.password, credential?.passwordHash);

    if (!account || !validPassword) {
      return { state: "invalid-credentials" };
    }
    if (!account.emailVerifiedAt) {
      return { state: "unverified", account };
    }

    const presentedHash = input.presentedToken ? hashTokenOrNull(input.presentedToken) : null;
    let issued: { token: string; expiresAt: Date } | undefined;

    if (presentedHash) {
      const [existing] = await tx
        .select({
          id: sessions.id,
          accountId: sessions.accountId,
          expiresAt: sessions.expiresAt,
        })
        .from(sessions)
        .where(and(eq(sessions.tokenHash, presentedHash), isNull(sessions.revokedAt)))
        .for("update");

      if (existing?.accountId === account.id && existing.expiresAt.getTime() > now.getTime()) {
        const [revoked] = await tx
          .update(sessions)
          .set({ revokedAt: now, revokedReason: "rotated" })
          .where(and(eq(sessions.id, existing.id), isNull(sessions.revokedAt)))
          .returning({ id: sessions.id });
        if (!revoked) {
          throw new Error("Presented session could not be rotated.");
        }

        const replacementToken = generateOpaqueToken();
        const replacementExpiresAt = expiryFrom(now, SESSION_TTL_MS);
        const [replacement] = await tx
          .insert(sessions)
          .values({
            accountId: account.id,
            tokenHash: hashBearerToken(replacementToken),
            expiresAt: replacementExpiresAt,
            createdAt: now,
            lastAccessedAt: now,
          })
          .returning({ id: sessions.id, expiresAt: sessions.expiresAt });
        if (!replacement) {
          throw new Error("Replacement session could not be created.");
        }

        await tx
          .update(sessions)
          .set({ replacedBySessionId: replacement.id })
          .where(eq(sessions.id, existing.id));
        issued = { token: replacementToken, expiresAt: replacement.expiresAt };
      } else if (existing) {
        await tx
          .update(sessions)
          .set({ revokedAt: now, revokedReason: "login-replaced" })
          .where(and(eq(sessions.id, existing.id), isNull(sessions.revokedAt)));
      }
    }

    if (!issued) {
      const token = generateOpaqueToken();
      const expiresAt = expiryFrom(now, SESSION_TTL_MS);
      const [session] = await tx
        .insert(sessions)
        .values({
          accountId: account.id,
          tokenHash: hashBearerToken(token),
          expiresAt,
          createdAt: now,
          lastAccessedAt: now,
        })
        .returning({ expiresAt: sessions.expiresAt });
      if (!session) {
        throw new Error("Session could not be created.");
      }
      issued = { token, expiresAt: session.expiresAt };
    }

    return { state: "authenticated", account, ...issued };
  });
}

export async function getEmailVerificationTokenState(
  db: Database,
  token: string,
  now = new Date(),
): Promise<OneTimeTokenState> {
  const tokenHash = hashTokenOrNull(token);
  if (!tokenHash) {
    return "invalid";
  }

  const [row] = await db
    .select({
      expiresAt: emailVerificationTokens.expiresAt,
      consumedAt: emailVerificationTokens.consumedAt,
      invalidatedAt: emailVerificationTokens.invalidatedAt,
    })
    .from(emailVerificationTokens)
    .where(eq(emailVerificationTokens.tokenHash, tokenHash))
    .limit(1);

  return row ? tokenState(row, now) : "invalid";
}

/** Consume the token and verify the account in one transaction. */
export async function verifyEmailAddress(
  db: Database,
  token: string,
  now = new Date(),
): Promise<VerificationOutcome> {
  const tokenHash = hashTokenOrNull(token);
  if (!tokenHash) {
    return { state: "invalid" };
  }

  return db.transaction(async (tx) => {
    const [candidate] = await tx
      .select({
        id: emailVerificationTokens.id,
        accountId: emailVerificationTokens.accountId,
        expiresAt: emailVerificationTokens.expiresAt,
        consumedAt: emailVerificationTokens.consumedAt,
        invalidatedAt: emailVerificationTokens.invalidatedAt,
      })
      .from(emailVerificationTokens)
      .where(eq(emailVerificationTokens.tokenHash, tokenHash));

    if (!candidate) {
      return { state: "invalid" };
    }

    const initialState = tokenState(candidate, now);
    if (initialState !== "valid") {
      return { state: initialState };
    }

    const [account] = await tx
      .select({ id: accounts.id, emailVerifiedAt: accounts.emailVerifiedAt })
      .from(accounts)
      .where(eq(accounts.id, candidate.accountId))
      .for("update");
    if (!account) {
      return { state: "invalid" };
    }

    const [lockedCandidate] = await tx
      .select({
        id: emailVerificationTokens.id,
        accountId: emailVerificationTokens.accountId,
        expiresAt: emailVerificationTokens.expiresAt,
        consumedAt: emailVerificationTokens.consumedAt,
        invalidatedAt: emailVerificationTokens.invalidatedAt,
      })
      .from(emailVerificationTokens)
      .where(eq(emailVerificationTokens.id, candidate.id))
      .for("update");
    if (!lockedCandidate) {
      return { state: "invalid" };
    }

    const state = tokenState(lockedCandidate, now);
    if (state !== "valid") {
      return { state };
    }

    const [consumed] = await tx
      .update(emailVerificationTokens)
      .set({ consumedAt: now })
      .where(
        and(
          eq(emailVerificationTokens.id, candidate.id),
          isNull(emailVerificationTokens.consumedAt),
          isNull(emailVerificationTokens.invalidatedAt),
          gt(emailVerificationTokens.expiresAt, now),
        ),
      )
      .returning({ id: emailVerificationTokens.id });

    if (!consumed) {
      return { state: "already-used" };
    }

    await tx
      .update(accounts)
      .set({ emailVerifiedAt: account.emailVerifiedAt ?? now, updatedAt: now })
      .where(eq(accounts.id, account.id));

    return {
      state: account.emailVerifiedAt ? "already-verified" : "verified",
      accountId: account.id,
    };
  });
}

export async function issuePasswordResetToken(
  db: Database,
  accountId: string,
  options: { now?: Date; ttlMs?: number } = {},
): Promise<{ account: Account; reset: IssuedToken } | null> {
  const now = options.now ?? new Date();
  const expiresAt = expiryFrom(now, options.ttlMs ?? PASSWORD_RESET_TOKEN_TTL_MS);
  const token = generateOpaqueToken();

  return db.transaction(async (tx) => {
    const [account] = await tx
      .select()
      .from(accounts)
      .where(eq(accounts.id, accountId))
      .for("update");
    if (!account) {
      return null;
    }

    const [credential] = await tx
      .select({ id: passwordCredentials.id })
      .from(passwordCredentials)
      .where(eq(passwordCredentials.accountId, accountId))
      .for("update");
    if (!credential) {
      return null;
    }

    await tx
      .update(passwordResetTokens)
      .set({ invalidatedAt: now })
      .where(
        and(
          eq(passwordResetTokens.accountId, accountId),
          isNull(passwordResetTokens.consumedAt),
          isNull(passwordResetTokens.invalidatedAt),
        ),
      );

    const [created] = await tx
      .insert(passwordResetTokens)
      .values({
        accountId,
        tokenHash: hashBearerToken(token),
        expiresAt,
        createdAt: now,
      })
      .returning({ id: passwordResetTokens.id, accountId: passwordResetTokens.accountId });

    if (!created) {
      throw new Error("Password reset token could not be created.");
    }

    return { account, reset: { ...created, token, expiresAt } };
  });
}

export async function getPasswordResetTokenState(
  db: Database,
  token: string,
  now = new Date(),
): Promise<OneTimeTokenState> {
  const tokenHash = hashTokenOrNull(token);
  if (!tokenHash) {
    return "invalid";
  }

  const [row] = await db
    .select({
      expiresAt: passwordResetTokens.expiresAt,
      consumedAt: passwordResetTokens.consumedAt,
      invalidatedAt: passwordResetTokens.invalidatedAt,
    })
    .from(passwordResetTokens)
    .where(eq(passwordResetTokens.tokenHash, tokenHash))
    .limit(1);

  return row ? tokenState(row, now) : "invalid";
}

/** Consume a reset token, replace the Argon2id credential, and revoke every session atomically. */
export async function resetPasswordWithToken(
  db: Database,
  token: string,
  password: string,
  now = new Date(),
): Promise<{ accountId: string } | { state: Exclude<OneTimeTokenState, "valid"> }> {
  const tokenHash = hashTokenOrNull(token);
  if (!tokenHash) {
    return { state: "invalid" };
  }
  validatePasswordInput(password);

  return db.transaction(async (tx) => {
    const [candidate] = await tx
      .select({
        id: passwordResetTokens.id,
        accountId: passwordResetTokens.accountId,
        expiresAt: passwordResetTokens.expiresAt,
        consumedAt: passwordResetTokens.consumedAt,
        invalidatedAt: passwordResetTokens.invalidatedAt,
      })
      .from(passwordResetTokens)
      .where(eq(passwordResetTokens.tokenHash, tokenHash));

    if (!candidate) {
      return { state: "invalid" };
    }

    const initialState = tokenState(candidate, now);
    if (initialState !== "valid") {
      return { state: initialState };
    }

    const [account] = await tx
      .select({ id: accounts.id })
      .from(accounts)
      .where(eq(accounts.id, candidate.accountId))
      .for("update");
    if (!account) {
      return { state: "invalid" };
    }

    const [lockedCandidate] = await tx
      .select({
        id: passwordResetTokens.id,
        accountId: passwordResetTokens.accountId,
        expiresAt: passwordResetTokens.expiresAt,
        consumedAt: passwordResetTokens.consumedAt,
        invalidatedAt: passwordResetTokens.invalidatedAt,
      })
      .from(passwordResetTokens)
      .where(eq(passwordResetTokens.id, candidate.id))
      .for("update");
    if (!lockedCandidate) {
      return { state: "invalid" };
    }

    const state = tokenState(lockedCandidate, now);
    if (state !== "valid") {
      return { state };
    }

    const passwordHash = await hashPassword(password);

    const [consumed] = await tx
      .update(passwordResetTokens)
      .set({ consumedAt: now })
      .where(
        and(
          eq(passwordResetTokens.id, candidate.id),
          isNull(passwordResetTokens.consumedAt),
          isNull(passwordResetTokens.invalidatedAt),
          gt(passwordResetTokens.expiresAt, now),
        ),
      )
      .returning({ id: passwordResetTokens.id });
    if (!consumed) {
      return { state: "already-used" };
    }

    const [credential] = await tx
      .update(passwordCredentials)
      .set({ passwordHash, passwordChangedAt: now, updatedAt: now })
      .where(eq(passwordCredentials.accountId, account.id))
      .returning({ id: passwordCredentials.id });
    if (!credential) {
      throw new Error("Password credential could not be updated.");
    }

    await tx
      .update(sessions)
      .set({ revokedAt: now, revokedReason: "password-reset" })
      .where(and(eq(sessions.accountId, account.id), isNull(sessions.revokedAt)));

    return { accountId: account.id };
  });
}

export { normalizeEmail };
