import { and, eq, gt, inArray, isNull, lte } from "drizzle-orm";
import { type Database } from "@/server/db/client";
import { oauthTransactions, type OAuthTransaction } from "@/server/db/schema";
import { generateOpaqueToken, hashBearerToken, safeHashEquals } from "./tokens";

export const GOOGLE_PROVIDER = "google";
export const OAUTH_TRANSACTION_TTL_MS = 10 * 60 * 1000;

export type OAuthIntent = "signin" | "link";

export interface CreatedOAuthTransaction {
  transaction: OAuthTransaction;
  state: string;
  codeVerifier: string;
}

export interface OAuthTransactionInput {
  provider: string;
  intent: OAuthIntent;
  accountId?: string;
  sessionId?: string;
  now?: Date;
  ttlMs?: number;
}

function expiryFrom(now: Date, ttlMs: number): Date {
  if (!Number.isFinite(now.getTime()) || !Number.isInteger(ttlMs) || ttlMs <= 0) {
    throw new Error("OAuth transaction expiry must be positive.");
  }
  return new Date(now.getTime() + ttlMs);
}

function validateIntentBinding(input: OAuthTransactionInput): void {
  if (input.intent === "link" && (!input.accountId || !input.sessionId)) {
    throw new Error("Link OAuth transactions require an account and session binding.");
  }
  if (input.intent === "signin" && (input.accountId || input.sessionId)) {
    throw new Error("Sign-in OAuth transactions cannot contain an account binding.");
  }
}

/** Create a one-time OAuth ceremony without persisting either raw bearer value. */
export async function createOAuthTransaction(
  db: Database,
  input: OAuthTransactionInput,
): Promise<CreatedOAuthTransaction> {
  validateIntentBinding(input);
  const now = input.now ?? new Date();
  const expiresAt = expiryFrom(now, input.ttlMs ?? OAUTH_TRANSACTION_TTL_MS);
  const state = generateOpaqueToken();
  const codeVerifier = generateOpaqueToken();

  const [transaction] = await db
    .insert(oauthTransactions)
    .values({
      provider: input.provider,
      stateHash: hashBearerToken(state),
      codeVerifierHash: hashBearerToken(codeVerifier),
      intent: input.intent,
      accountId: input.accountId,
      sessionId: input.sessionId,
      expiresAt,
      createdAt: now,
    })
    .returning();

  if (!transaction) {
    throw new Error("OAuth transaction could not be created.");
  }

  return { transaction, state, codeVerifier };
}

export interface ConsumedOAuthTransaction {
  transaction: OAuthTransaction;
  codeVerifier: string;
}

/**
 * Validate and consume state plus PKCE material under one row lock. A second
 * callback for the same ceremony therefore cannot reach the provider or issue
 * another session, even when both requests arrive concurrently.
 */
export async function consumeOAuthTransaction(
  db: Database,
  input: {
    provider: string;
    state: string;
    codeVerifier: string;
    now?: Date;
  },
): Promise<ConsumedOAuthTransaction | null> {
  const now = input.now ?? new Date();
  let stateHash: string;
  let codeVerifierHash: string;
  try {
    stateHash = hashBearerToken(input.state);
    codeVerifierHash = hashBearerToken(input.codeVerifier);
  } catch {
    return null;
  }

  return db.transaction(async (tx) => {
    const [candidate] = await tx
      .select()
      .from(oauthTransactions)
      .where(
        and(
          eq(oauthTransactions.provider, input.provider),
          eq(oauthTransactions.stateHash, stateHash),
        ),
      )
      .for("update");

    if (
      !candidate ||
      candidate.consumedAt ||
      candidate.expiresAt.getTime() <= now.getTime() ||
      !safeHashEquals(candidate.codeVerifierHash, codeVerifierHash)
    ) {
      return null;
    }

    const [consumed] = await tx
      .update(oauthTransactions)
      .set({ consumedAt: now })
      .where(
        and(
          eq(oauthTransactions.id, candidate.id),
          isNull(oauthTransactions.consumedAt),
          gt(oauthTransactions.expiresAt, now),
        ),
      )
      .returning();

    return consumed ? { transaction: consumed, codeVerifier: input.codeVerifier } : null;
  });
}

/** Keep expired ceremony rows bounded without retaining any OAuth material. */
export async function pruneExpiredOAuthTransactions(
  db: Database,
  now = new Date(),
): Promise<number> {
  const expired = await db
    .select({ id: oauthTransactions.id })
    .from(oauthTransactions)
    .where(lte(oauthTransactions.expiresAt, now))
    .orderBy(oauthTransactions.expiresAt)
    .limit(100);
  if (expired.length === 0) {
    return 0;
  }

  const deleted = await db
    .delete(oauthTransactions)
    .where(
      inArray(
        oauthTransactions.id,
        expired.map(({ id }) => id),
      ),
    )
    .returning({ id: oauthTransactions.id });
  return deleted.length;
}
