import { afterAll, describe, expect, it } from "vitest";
import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDatabase, closeDatabase } from "@/server/db/client";
import {
  accounts,
  authRateLimits,
  passwordCredentials,
  emailVerificationTokens,
  passwordResetTokens,
  sessions,
} from "@/server/db/schema";
import {
  createAccount,
  setPasswordCredential,
  verifyAccountPassword,
} from "@/server/modules/auth/accounts";
import {
  consumeEmailVerificationToken,
  consumePasswordResetToken,
  createEmailVerificationToken,
  createPasswordResetToken,
} from "@/server/modules/auth/tokens";
import {
  createSession,
  lookupSession,
  revokeAllAccountSessions,
  revokeSession,
  revokeSessionById,
  rotateSession,
} from "@/server/modules/auth/sessions";
import { consumeRateLimit, rateLimitKey } from "@/server/modules/auth/rate-limit";
import { protectedRoute } from "@/server/http/authentication";

const integration = process.env.DATABASE_URL ? describe : describe.skip;
const db = process.env.DATABASE_URL ? getDatabase() : undefined;

async function account(emailPrefix: string) {
  if (!db) {
    throw new Error("Database integration is unavailable.");
  }

  return createAccount(db, {
    email: `${emailPrefix}-${crypto.randomUUID()}@example.test`,
  });
}

integration("database-backed authentication foundation", () => {
  afterAll(async () => {
    await closeDatabase();
  });

  it("normalizes email identity, hashes credentials, and isolates credential reads", async () => {
    if (!db) return;
    const owner = await createAccount(db, {
      email: `  Mixed-${crypto.randomUUID()}@Example.TEST `,
    });

    expect(owner.normalizedEmail).toBe(owner.email.toLowerCase());
    const credential = await setPasswordCredential(db, owner.id, "database-safe-password");
    expect(credential).not.toHaveProperty("passwordHash");
    await expect(verifyAccountPassword(db, owner.id, "database-safe-password")).resolves.toBe(true);
    await expect(verifyAccountPassword(db, owner.id, "wrong-password")).resolves.toBe(false);

    const stored = await db
      .select({ passwordHash: passwordCredentials.passwordHash })
      .from(passwordCredentials)
      .where(eq(passwordCredentials.accountId, owner.id));
    expect(stored[0]?.passwordHash).toContain("$argon2id$");
    expect(stored[0]?.passwordHash).not.toContain("database-safe-password");

    await expect(createAccount(db, { email: owner.email.toUpperCase() })).rejects.toThrow();
    await db.delete(accounts).where(eq(accounts.id, owner.id));
  });

  it("atomically consumes verification and reset tokens once and rejects expiry", async () => {
    if (!db) return;
    const owner = await account("tokens");
    const now = new Date("2026-01-01T00:00:00.000Z");
    const verification = await createEmailVerificationToken(db, owner.id, {
      now,
      ttlMs: 60_000,
    });
    const reset = await createPasswordResetToken(db, owner.id, { now, ttlMs: 60_000 });

    const storedVerification = await db
      .select({ tokenHash: emailVerificationTokens.tokenHash })
      .from(emailVerificationTokens)
      .where(eq(emailVerificationTokens.id, verification.id));
    const storedReset = await db
      .select({ tokenHash: passwordResetTokens.tokenHash })
      .from(passwordResetTokens)
      .where(eq(passwordResetTokens.id, reset.id));
    expect(storedVerification[0]?.tokenHash).not.toBe(verification.token);
    expect(storedReset[0]?.tokenHash).not.toBe(reset.token);

    await expect(consumeEmailVerificationToken(db, verification.token, now)).resolves.toMatchObject(
      {
        accountId: owner.id,
      },
    );
    await expect(consumeEmailVerificationToken(db, verification.token, now)).resolves.toBeNull();
    await expect(
      consumePasswordResetToken(db, reset.token, new Date("2026-01-01T00:01:01.000Z")),
    ).resolves.toBeNull();

    await db.delete(accounts).where(eq(accounts.id, owner.id));
  });

  it("creates, looks up, rotates, expires, and revokes account-bound sessions", async () => {
    if (!db) return;
    const owner = await account("sessions-owner");
    const other = await account("sessions-other");
    const now = new Date("2026-02-01T00:00:00.000Z");
    const first = await createSession(db, owner.id, { now, ttlMs: 60_000 });
    expect(await lookupSession(db, first.token, now)).toMatchObject({ accountId: owner.id });

    const rotated = await rotateSession(db, first.token, { now: new Date(now.getTime() + 1) });
    expect(rotated).not.toBeNull();
    expect(await lookupSession(db, first.token, now)).toBeNull();
    expect(await lookupSession(db, rotated!.token, now)).toMatchObject({ accountId: owner.id });

    const expiring = await createSession(db, owner.id, { now, ttlMs: 1_000 });
    expect(await lookupSession(db, expiring.token, new Date(now.getTime() + 1_001))).toBeNull();
    expect(
      await revokeSession(db, rotated!.token, "test-revocation", new Date(now.getTime() + 2)),
    ).toBe(true);
    expect(await lookupSession(db, rotated!.token, now)).toBeNull();

    const ownerSession = await createSession(db, owner.id, { now });
    const ownerOtherSession = await createSession(db, owner.id, { now });
    const otherSession = await createSession(db, other.id, { now });
    expect(await revokeSessionById(db, other.id, ownerSession.session.id)).toBe(false);
    expect(
      await revokeAllAccountSessions(db, owner.id, {
        exceptSessionId: ownerOtherSession.session.id,
      }),
    ).toBeGreaterThanOrEqual(1);
    expect(await lookupSession(db, ownerOtherSession.token, now)).toMatchObject({
      accountId: owner.id,
    });
    expect(await lookupSession(db, ownerSession.token, now)).toBeNull();
    expect(await lookupSession(db, otherSession.token, now)).toMatchObject({ accountId: other.id });

    await db.delete(accounts).where(eq(accounts.id, owner.id));
    await db.delete(accounts).where(eq(accounts.id, other.id));
  });

  it("uses the authenticated session account rather than a client account id", async () => {
    if (!db) return;
    const owner = await account("boundary-owner");
    const other = await account("boundary-other");
    const issued = await createSession(db, owner.id, { ttlMs: 60_000 });

    const authenticatedRequest = new Request(
      `http://localhost:3000/api/private?accountId=${other.id}`,
      {
        headers: { cookie: `taskfella_session=${issued.token}` },
      },
    );
    const response = await protectedRoute(
      authenticatedRequest,
      async ({ account: authenticatedAccount }) =>
        NextResponse.json({ accountId: authenticatedAccount.id }),
      { db },
    );
    await expect(response.json()).resolves.toEqual({ accountId: owner.id });

    const unauthenticated = await protectedRoute(
      new Request("http://localhost:3000/api/private"),
      async () => NextResponse.json({ shouldNotRun: true }),
      { db },
    );
    expect(unauthenticated.status).toBe(401);
    expect(await unauthenticated.json()).toMatchObject({ error: { code: "UNAUTHORIZED" } });

    await db.delete(accounts).where(eq(accounts.id, owner.id));
    await db.delete(accounts).where(eq(accounts.id, other.id));
  });

  it("enforces origin and CSRF checks at the protected mutation boundary", async () => {
    if (!db) return;
    const owner = await account("csrf");
    const issued = await createSession(db, owner.id, { ttlMs: 60_000 });
    const csrfToken = "csrf-test-token";
    const validRequest = new Request("http://localhost:3000/api/private", {
      method: "POST",
      headers: {
        origin: "http://localhost:3000",
        cookie: `taskfella_session=${issued.token}; taskfella_csrf=${csrfToken}`,
        "x-csrf-token": csrfToken,
      },
    });
    const accepted = await protectedRoute(
      validRequest,
      async () => NextResponse.json({ ok: true }),
      { db, mutation: true },
    );
    expect(accepted.status).toBe(200);

    const rejected = await protectedRoute(
      new Request("http://localhost:3000/api/private", {
        method: "POST",
        headers: {
          origin: "https://evil.example",
          cookie: `taskfella_session=${issued.token}; taskfella_csrf=${csrfToken}`,
          "x-csrf-token": csrfToken,
        },
      }),
      async () => NextResponse.json({ shouldNotRun: true }),
      { db, mutation: true },
    );
    expect(rejected.status).toBe(403);

    await db.delete(accounts).where(eq(accounts.id, owner.id));
  });

  it("makes concurrent rate-limit decisions atomically and resets after expiry", async () => {
    if (!db) return;
    const subject = `rate-limit-${crypto.randomUUID()}`;
    const now = new Date("2026-03-01T00:00:00.000Z");
    const policy = { maxAttempts: 3, windowMs: 60_000 };
    const results = await Promise.all(
      Array.from({ length: 8 }, () =>
        consumeRateLimit(db, { operation: "login", subject }, policy, now),
      ),
    );

    expect(results.filter((result) => result.allowed)).toHaveLength(3);
    expect(results.filter((result) => !result.allowed)).toHaveLength(5);
    expect(
      (
        await consumeRateLimit(
          db,
          { operation: "login", subject },
          policy,
          new Date(now.getTime() + 60_001),
        )
      ).allowed,
    ).toBe(true);
  });

  it("keeps concurrent consumption safe while pruning an expired bucket", async () => {
    if (!db) return;
    const subject = `rate-limit-expired-${crypto.randomUUID()}`;
    const now = new Date("2026-03-02T00:00:00.000Z");
    const policy = { maxAttempts: 3, windowMs: 60_000 };
    const keyHash = rateLimitKey("login", subject);
    await db.insert(authRateLimits).values({
      keyHash,
      attempts: policy.maxAttempts,
      windowStartedAt: new Date(now.getTime() - policy.windowMs),
      expiresAt: new Date(now.getTime() - 1),
      updatedAt: new Date(now.getTime() - 1),
    });

    const outcomes = await Promise.allSettled(
      Array.from({ length: 32 }, () =>
        consumeRateLimit(db, { operation: "login", subject }, policy, now),
      ),
    );
    const results = outcomes.flatMap((outcome) =>
      outcome.status === "fulfilled" ? [outcome.value] : [],
    );

    expect(outcomes.every((outcome) => outcome.status === "fulfilled")).toBe(true);
    expect(results.filter((result) => result.allowed)).toHaveLength(policy.maxAttempts);
    expect(results.filter((result) => !result.allowed)).toHaveLength(32 - policy.maxAttempts);
    await db.delete(authRateLimits).where(eq(authRateLimits.keyHash, keyHash));
  });

  it("prunes expired buckets during shared rate-limit consumption", async () => {
    if (!db) return;
    const now = new Date();
    const staleKey = rateLimitKey("maintenance", crypto.randomUUID());
    const activeSubject = crypto.randomUUID();
    const activeKey = rateLimitKey("maintenance", activeSubject);
    await db.insert(authRateLimits).values({
      keyHash: staleKey,
      attempts: 1,
      windowStartedAt: new Date(now.getTime() - 2_000),
      expiresAt: new Date(now.getTime() - 1_000),
      updatedAt: new Date(now.getTime() - 1_000),
    });

    await consumeRateLimit(
      db,
      { operation: "maintenance", subject: activeSubject },
      { maxAttempts: 3, windowMs: 60_000 },
      now,
    );

    const staleRows = await db
      .select({ keyHash: authRateLimits.keyHash })
      .from(authRateLimits)
      .where(eq(authRateLimits.keyHash, staleKey));
    expect(staleRows).toHaveLength(0);
    await db.delete(authRateLimits).where(eq(authRateLimits.keyHash, activeKey));
  });

  it("cascades authentication records when an account is deleted", async () => {
    if (!db) return;
    const owner = await account("cascade");
    const session = await createSession(db, owner.id);
    const verification = await createEmailVerificationToken(db, owner.id);
    const reset = await createPasswordResetToken(db, owner.id);
    await db.delete(accounts).where(eq(accounts.id, owner.id));

    expect(
      await db.select().from(sessions).where(eq(sessions.id, session.session.id)),
    ).toHaveLength(0);
    expect(
      await db
        .select()
        .from(emailVerificationTokens)
        .where(eq(emailVerificationTokens.id, verification.id)),
    ).toHaveLength(0);
    expect(
      await db.select().from(passwordResetTokens).where(eq(passwordResetTokens.id, reset.id)),
    ).toHaveLength(0);
  });
});
