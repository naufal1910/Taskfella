import { and, eq, gt, isNull } from "drizzle-orm";
import { type Database } from "@/server/db/client";
import {
  accounts,
  oauthIdentities,
  sessions,
  type Account,
  type OAuthIdentity,
  type OAuthTransaction,
} from "@/server/db/schema";
import {
  isUniqueConstraintViolation,
  lockEmailOwnership,
  normalizeEmail,
  validateEmail,
} from "./accounts";
import { type GoogleIdentityProfile } from "./google";
import { type CreatedSession, issueSessionForAccountInTransaction } from "./sessions";
import { hashBearerToken } from "./tokens";

export type GoogleIdentityResult =
  | {
      state: "authenticated" | "created" | "linked" | "already-linked";
      account: Account;
      session: CreatedSession;
    }
  | { state: "link-required" | "identity-conflict" | "email-conflict" | "session-invalid" };

class BoundSessionInvalidError extends Error {}

function nowOrDefault(now?: Date): Date {
  const value = now ?? new Date();
  if (!Number.isFinite(value.getTime())) {
    throw new Error("OAuth identity timestamp is invalid.");
  }
  return value;
}

async function findIdentity(
  tx: Parameters<Parameters<Database["transaction"]>[0]>[0],
  provider: string,
  subject: string,
): Promise<OAuthIdentity | null> {
  const [identity] = await tx
    .select()
    .from(oauthIdentities)
    .where(
      and(eq(oauthIdentities.provider, provider), eq(oauthIdentities.providerSubject, subject)),
    )
    .for("update");
  return identity ?? null;
}

async function readIdentity(
  tx: Parameters<Parameters<Database["transaction"]>[0]>[0],
  provider: string,
  subject: string,
): Promise<OAuthIdentity | null> {
  const [identity] = await tx
    .select()
    .from(oauthIdentities)
    .where(
      and(eq(oauthIdentities.provider, provider), eq(oauthIdentities.providerSubject, subject)),
    );
  return identity ?? null;
}

async function findAccount(
  tx: Parameters<Parameters<Database["transaction"]>[0]>[0],
  accountId: string,
): Promise<Account | null> {
  const [account] = await tx
    .select()
    .from(accounts)
    .where(eq(accounts.id, accountId))
    .for("update");
  return account ?? null;
}

async function readAccount(
  tx: Parameters<Parameters<Database["transaction"]>[0]>[0],
  accountId: string,
): Promise<Account | null> {
  const [account] = await tx.select().from(accounts).where(eq(accounts.id, accountId));
  return account ?? null;
}

async function lockAccountsInOrder(
  tx: Parameters<Parameters<Database["transaction"]>[0]>[0],
  accountIds: Array<string | undefined>,
): Promise<Account[]> {
  const orderedIds = Array.from(
    new Set(accountIds.filter((accountId): accountId is string => Boolean(accountId))),
  ).sort();
  const lockedAccounts: Account[] = [];
  for (const accountId of orderedIds) {
    const account = await findAccount(tx, accountId);
    if (account) {
      lockedAccounts.push(account);
    }
  }
  return lockedAccounts;
}

async function rotateBoundSession(
  tx: Parameters<Parameters<Database["transaction"]>[0]>[0],
  account: Account,
  transaction: OAuthTransaction,
  presentedToken: string | undefined,
  now: Date,
): Promise<CreatedSession | null> {
  if (!transaction.accountId || !transaction.sessionId || !presentedToken) {
    return null;
  }

  let tokenHash: string;
  try {
    tokenHash = hashBearerToken(presentedToken);
  } catch {
    return null;
  }

  const [boundSession] = await tx
    .select({ id: sessions.id })
    .from(sessions)
    .where(
      and(
        eq(sessions.id, transaction.sessionId),
        eq(sessions.accountId, transaction.accountId),
        eq(sessions.accountId, account.id),
        eq(sessions.tokenHash, tokenHash),
        isNull(sessions.revokedAt),
        gt(sessions.expiresAt, now),
      ),
    )
    .for("update");
  if (!boundSession) {
    return null;
  }

  return issueSessionForAccountInTransaction(tx, account.id, {
    presentedToken,
    now,
  });
}

/** Return only provider labels and timestamps; subjects and provider payloads stay private. */
export async function listAccountOAuthIdentities(
  db: Database,
  accountId: string,
): Promise<Array<Pick<OAuthIdentity, "provider" | "createdAt">>> {
  return db
    .select({ provider: oauthIdentities.provider, createdAt: oauthIdentities.createdAt })
    .from(oauthIdentities)
    .where(eq(oauthIdentities.accountId, accountId));
}

/**
 * Apply a verified Google identity to the explicit sign-in or link ceremony.
 * The transaction owns account, identity, and session changes together so a
 * callback never leaves a partially authenticated or partially linked account.
 */
export async function completeGoogleIdentity(
  db: Database,
  input: {
    transaction: OAuthTransaction;
    profile: GoogleIdentityProfile;
    presentedToken?: string;
    now?: Date;
  },
): Promise<GoogleIdentityResult> {
  const now = nowOrDefault(input.now);
  const normalizedEmail = validateEmail(input.profile.email);
  const provider = input.transaction.provider;
  const subject = input.profile.subject;

  const transaction = db.transaction(async (tx) => {
    if (input.transaction.intent === "link") {
      if (!input.transaction.accountId || !input.transaction.sessionId) {
        return { state: "session-invalid" };
      }

      await lockEmailOwnership(tx, normalizedEmail);
      const accountCandidate = await readAccount(tx, input.transaction.accountId);
      if (!accountCandidate) {
        return { state: "session-invalid" };
      }

      const [emailOwnerCandidate] = await tx
        .select({ id: accounts.id })
        .from(accounts)
        .where(eq(accounts.normalizedEmail, normalizedEmail));
      const lockedAccounts = await lockAccountsInOrder(tx, [
        accountCandidate.id,
        emailOwnerCandidate?.id,
      ]);
      const account = lockedAccounts.find(({ id }) => id === accountCandidate.id);
      if (!account) {
        return { state: "session-invalid" };
      }
      const emailOwner = emailOwnerCandidate
        ? lockedAccounts.find(({ id }) => id === emailOwnerCandidate.id)
        : undefined;
      const existingIdentity = await findIdentity(tx, provider, subject);

      if (existingIdentity && existingIdentity.accountId !== account.id) {
        return { state: "identity-conflict" };
      }

      if (
        existingIdentity ||
        (
          await tx
            .select({ id: oauthIdentities.id })
            .from(oauthIdentities)
            .where(
              and(
                eq(oauthIdentities.accountId, account.id),
                eq(oauthIdentities.provider, provider),
              ),
            )
            .for("update")
        ).length > 0
      ) {
        const session = await rotateBoundSession(
          tx,
          account,
          input.transaction,
          input.presentedToken,
          now,
        );
        return session
          ? { state: "already-linked", account, session }
          : { state: "session-invalid" };
      }

      if (emailOwner && emailOwner.id !== account.id) {
        return { state: "email-conflict" };
      }

      let inserted: OAuthIdentity | undefined;
      try {
        [inserted] = await tx
          .insert(oauthIdentities)
          .values({
            accountId: account.id,
            provider,
            providerSubject: subject,
            createdAt: now,
            updatedAt: now,
          })
          .onConflictDoNothing()
          .returning();
      } catch (error) {
        if (!isUniqueConstraintViolation(error)) throw error;
      }

      if (!inserted) {
        const racedIdentity = await findIdentity(tx, provider, subject);
        if (racedIdentity?.accountId !== account.id) {
          return { state: "identity-conflict" };
        }
        const session = await rotateBoundSession(
          tx,
          account,
          input.transaction,
          input.presentedToken,
          now,
        );
        return session
          ? { state: "already-linked", account, session }
          : { state: "session-invalid" };
      }

      const session = await rotateBoundSession(
        tx,
        account,
        input.transaction,
        input.presentedToken,
        now,
      );
      if (!session) {
        throw new BoundSessionInvalidError();
      }
      return { state: "linked", account, session };
    }

    await lockEmailOwnership(tx, normalizedEmail);
    const identityCandidate = await readIdentity(tx, provider, subject);
    if (identityCandidate) {
      const account = await findAccount(tx, identityCandidate.accountId);
      if (!account) {
        return { state: "identity-conflict" };
      }
      const existingIdentity = await findIdentity(tx, provider, subject);
      if (!existingIdentity || existingIdentity.accountId !== account.id) {
        return { state: "identity-conflict" };
      }
      const session = await issueSessionForAccountInTransaction(tx, account.id, {
        presentedToken: input.presentedToken,
        now,
      });
      return { state: "authenticated", account, session };
    }

    const [emailOwner] = await tx
      .select()
      .from(accounts)
      .where(eq(accounts.normalizedEmail, normalizedEmail))
      .for("update");
    if (emailOwner) {
      return { state: "link-required" };
    }

    let account: Account | undefined;
    try {
      [account] = await tx
        .insert(accounts)
        .values({
          email: input.profile.email.trim(),
          normalizedEmail: normalizeEmail(input.profile.email),
          emailVerifiedAt: now,
          createdAt: now,
          updatedAt: now,
        })
        .onConflictDoNothing()
        .returning();
    } catch (error) {
      if (!isUniqueConstraintViolation(error)) throw error;
    }

    if (!account) {
      const [racedAccount] = await tx
        .select()
        .from(accounts)
        .where(eq(accounts.normalizedEmail, normalizedEmail))
        .for("update");
      return racedAccount ? { state: "link-required" } : { state: "identity-conflict" };
    }

    let inserted: OAuthIdentity | undefined;
    try {
      [inserted] = await tx
        .insert(oauthIdentities)
        .values({
          accountId: account.id,
          provider,
          providerSubject: subject,
          createdAt: now,
          updatedAt: now,
        })
        .onConflictDoNothing()
        .returning();
    } catch (error) {
      if (!isUniqueConstraintViolation(error)) throw error;
    }

    if (!inserted) {
      // A competing callback may have won the provider-subject race after the
      // initial lookup. Remove only the account created by this transaction.
      await tx.delete(accounts).where(eq(accounts.id, account.id));
      const racedIdentity = await findIdentity(tx, provider, subject);
      if (!racedIdentity) {
        return { state: "identity-conflict" };
      }
      const racedAccount = await findAccount(tx, racedIdentity.accountId);
      if (!racedAccount) {
        return { state: "identity-conflict" };
      }
      const session = await issueSessionForAccountInTransaction(tx, racedAccount.id, {
        presentedToken: input.presentedToken,
        now,
      });
      return { state: "authenticated", account: racedAccount, session };
    }

    const session = await issueSessionForAccountInTransaction(tx, account.id, {
      presentedToken: input.presentedToken,
      now,
    });
    return { state: "created", account, session };
  });
  return transaction.catch((error) => {
    if (error instanceof BoundSessionInvalidError) {
      return { state: "session-invalid" };
    }
    throw error;
  });
}
