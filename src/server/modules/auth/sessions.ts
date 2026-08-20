import { and, eq, gt, isNull, ne } from "drizzle-orm";
import { type Database } from "@/server/db/client";
import { sessions, type Session } from "@/server/db/schema";
import { generateOpaqueToken, hashBearerToken } from "./tokens";

export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

type SessionTransaction = Parameters<Parameters<Database["transaction"]>[0]>[0];
export type SessionDatabase = Database | SessionTransaction;

export type AuthenticatedSession = Pick<
  Session,
  | "id"
  | "accountId"
  | "expiresAt"
  | "lastAccessedAt"
  | "revokedAt"
  | "revokedReason"
  | "replacedBySessionId"
  | "createdAt"
>;

export interface CreatedSession {
  session: AuthenticatedSession;
  /** The only point at which the opaque bearer value is available. */
  token: string;
}

function sessionFields() {
  return {
    id: sessions.id,
    accountId: sessions.accountId,
    expiresAt: sessions.expiresAt,
    lastAccessedAt: sessions.lastAccessedAt,
    revokedAt: sessions.revokedAt,
    revokedReason: sessions.revokedReason,
    replacedBySessionId: sessions.replacedBySessionId,
    createdAt: sessions.createdAt,
  };
}

function expiryFrom(now: Date, ttlMs: number): Date {
  if (!Number.isFinite(now.getTime()) || !Number.isFinite(ttlMs) || ttlMs <= 0) {
    throw new Error("Session expiry must be positive.");
  }

  return new Date(now.getTime() + ttlMs);
}

export async function createSession(
  db: SessionDatabase,
  accountId: string,
  options: { now?: Date; ttlMs?: number } = {},
): Promise<CreatedSession> {
  const now = options.now ?? new Date();
  const expiresAt = expiryFrom(now, options.ttlMs ?? SESSION_TTL_MS);
  const token = generateOpaqueToken();
  const [session] = await db
    .insert(sessions)
    .values({
      accountId,
      tokenHash: hashBearerToken(token),
      expiresAt,
      createdAt: now,
      lastAccessedAt: now,
    })
    .returning(sessionFields());

  if (!session) {
    throw new Error("Session could not be created.");
  }

  return { session, token };
}

/** Look up an unrevoked, unexpired session by its raw cookie value. */
export async function lookupSession(
  db: Database,
  token: string,
  now = new Date(),
): Promise<AuthenticatedSession | null> {
  let tokenHash: string;
  try {
    tokenHash = hashBearerToken(token);
  } catch {
    return null;
  }

  const [session] = await db
    .select(sessionFields())
    .from(sessions)
    .where(
      and(
        eq(sessions.tokenHash, tokenHash),
        isNull(sessions.revokedAt),
        gt(sessions.expiresAt, now),
      ),
    )
    .limit(1);

  if (!session) {
    return null;
  }

  // Recheck revocation in the write so a concurrent logout cannot leave this
  // request authenticated with a stale row.
  const [updated] = await db
    .update(sessions)
    .set({ lastAccessedAt: now })
    .where(and(eq(sessions.id, session.id), isNull(sessions.revokedAt)))
    .returning(sessionFields());

  return updated ?? null;
}

/** Rotate a bearer value while the caller's transaction still owns the row update. */
export async function rotateSessionInTransaction(
  tx: SessionTransaction,
  token: string,
  options: { now?: Date; ttlMs?: number } = {},
): Promise<CreatedSession | null> {
  let tokenHash: string;
  try {
    tokenHash = hashBearerToken(token);
  } catch {
    return null;
  }

  const now = options.now ?? new Date();
  const expiresAt = expiryFrom(now, options.ttlMs ?? SESSION_TTL_MS);
  const [oldSession] = await tx
    .update(sessions)
    .set({ revokedAt: now, revokedReason: "rotated" })
    .where(
      and(
        eq(sessions.tokenHash, tokenHash),
        isNull(sessions.revokedAt),
        gt(sessions.expiresAt, now),
      ),
    )
    .returning({ id: sessions.id, accountId: sessions.accountId });

  if (!oldSession) {
    return null;
  }

  const replacementToken = generateOpaqueToken();
  const [replacement] = await tx
    .insert(sessions)
    .values({
      accountId: oldSession.accountId,
      tokenHash: hashBearerToken(replacementToken),
      expiresAt,
      createdAt: now,
      lastAccessedAt: now,
    })
    .returning(sessionFields());

  if (!replacement) {
    throw new Error("Replacement session could not be created.");
  }

  await tx
    .update(sessions)
    .set({ replacedBySessionId: replacement.id })
    .where(eq(sessions.id, oldSession.id));

  return { session: replacement, token: replacementToken };
}

/**
 * Revoke the presented session and issue a replacement in one transaction.
 * The conditional update makes concurrent rotations single-winner: a second
 * request cannot rotate an already-revoked bearer value.
 */
export async function rotateSession(
  db: Database,
  token: string,
  options: { now?: Date; ttlMs?: number } = {},
): Promise<CreatedSession | null> {
  return db.transaction((tx) => rotateSessionInTransaction(tx, token, options));
}

/** Issue a session for an OAuth account without reusing a foreign browser session. */
export async function issueSessionForAccountInTransaction(
  tx: SessionTransaction,
  accountId: string,
  options: { presentedToken?: string; now?: Date; ttlMs?: number } = {},
): Promise<CreatedSession> {
  const now = options.now ?? new Date();
  const presentedToken = options.presentedToken;
  if (presentedToken) {
    let tokenHash: string | undefined;
    try {
      tokenHash = hashBearerToken(presentedToken);
    } catch {
      tokenHash = undefined;
    }

    if (tokenHash) {
      const [existing] = await tx
        .select({
          id: sessions.id,
          accountId: sessions.accountId,
          expiresAt: sessions.expiresAt,
          revokedAt: sessions.revokedAt,
        })
        .from(sessions)
        .where(eq(sessions.tokenHash, tokenHash))
        .for("update");

      if (existing?.accountId === accountId && !existing.revokedAt && existing.expiresAt > now) {
        const rotated = await rotateSessionInTransaction(tx, presentedToken, options);
        if (rotated) {
          return rotated;
        }
      } else if (existing && !existing.revokedAt) {
        await tx
          .update(sessions)
          .set({ revokedAt: now, revokedReason: "login-replaced" })
          .where(and(eq(sessions.id, existing.id), isNull(sessions.revokedAt)));
      }
    }
  }

  return createSession(tx, accountId, options);
}

export async function revokeSession(
  db: Database,
  token: string,
  reason = "logout",
  now = new Date(),
): Promise<boolean> {
  let tokenHash: string;
  try {
    tokenHash = hashBearerToken(token);
  } catch {
    return false;
  }

  const revoked = await db
    .update(sessions)
    .set({ revokedAt: now, revokedReason: reason })
    .where(and(eq(sessions.tokenHash, tokenHash), isNull(sessions.revokedAt)))
    .returning({ id: sessions.id });

  return revoked.length > 0;
}

export async function revokeSessionById(
  db: Database,
  accountId: string,
  sessionId: string,
  reason = "revoked",
  now = new Date(),
): Promise<boolean> {
  const revoked = await db
    .update(sessions)
    .set({ revokedAt: now, revokedReason: reason })
    .where(
      and(
        eq(sessions.id, sessionId),
        eq(sessions.accountId, accountId),
        isNull(sessions.revokedAt),
      ),
    )
    .returning({ id: sessions.id });

  return revoked.length > 0;
}

/** Invalidate every session belonging to the authenticated account. */
export async function revokeAllAccountSessions(
  db: Database,
  accountId: string,
  options: { exceptSessionId?: string; reason?: string; now?: Date } = {},
): Promise<number> {
  const now = options.now ?? new Date();
  const condition = options.exceptSessionId
    ? and(
        eq(sessions.accountId, accountId),
        isNull(sessions.revokedAt),
        ne(sessions.id, options.exceptSessionId),
      )
    : and(eq(sessions.accountId, accountId), isNull(sessions.revokedAt));
  const revoked = await db
    .update(sessions)
    .set({ revokedAt: now, revokedReason: options.reason ?? "account-wide-invalidation" })
    .where(condition)
    .returning({ id: sessions.id });

  return revoked.length;
}

export const invalidateAccountSessions = revokeAllAccountSessions;
