import { createHash } from "node:crypto";
import { and, eq, inArray, lte, sql } from "drizzle-orm";
import { type Database } from "@/server/db/client";
import { authRateLimits } from "@/server/db/schema";
import { AppError } from "@/server/http/errors";

export interface RateLimitPolicy {
  maxAttempts: number;
  windowMs: number;
}

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  retryAfterSeconds: number;
}

export const AUTH_RATE_LIMITS = {
  login: { maxAttempts: 10, windowMs: 15 * 60 * 1000 },
  signup: { maxAttempts: 5, windowMs: 60 * 60 * 1000 },
  emailVerification: { maxAttempts: 5, windowMs: 60 * 60 * 1000 },
  passwordReset: { maxAttempts: 5, windowMs: 60 * 60 * 1000 },
  oauthStart: { maxAttempts: 10, windowMs: 15 * 60 * 1000 },
  oauthFailure: { maxAttempts: 10, windowMs: 15 * 60 * 1000 },
} as const satisfies Record<string, RateLimitPolicy>;

const RATE_LIMIT_PRUNE_BATCH_SIZE = 100;

type RateLimitTransaction = Parameters<Parameters<Database["transaction"]>[0]>[0];
type RateLimitDatabase = Database | RateLimitTransaction;

function validatePolicy(policy: RateLimitPolicy): void {
  if (
    !Number.isInteger(policy.maxAttempts) ||
    policy.maxAttempts < 1 ||
    policy.maxAttempts > 1000 ||
    !Number.isInteger(policy.windowMs) ||
    policy.windowMs < 1000 ||
    policy.windowMs > 24 * 60 * 60 * 1000
  ) {
    throw new Error("Rate-limit policy is outside the supported bounds.");
  }
}

/** Hash operation and subject together so email/IP identifiers are not retained. */
export function rateLimitKey(operation: string, subject: string): string {
  if (
    typeof operation !== "string" ||
    operation.length === 0 ||
    operation.length > 128 ||
    typeof subject !== "string" ||
    subject.length === 0 ||
    subject.length > 512
  ) {
    throw new Error("Rate-limit key input is invalid.");
  }

  return createHash("sha256")
    .update(`taskfella-rate-limit:${operation}:${subject}`, "utf8")
    .digest("hex");
}

/**
 * Atomically consume one attempt from a bounded PostgreSQL fixed-window bucket.
 * The insert establishes a row for new keys; the row lock makes reset, allow,
 * and deny decisions single-winner under concurrent requests.
 */
export async function consumeRateLimit(
  db: Database,
  input: { operation: string; subject: string },
  policy: RateLimitPolicy,
  now = new Date(),
): Promise<RateLimitResult> {
  validatePolicy(policy);
  if (!Number.isFinite(now.getTime())) {
    throw new Error("Rate-limit timestamp is invalid.");
  }

  const keyHash = rateLimitKey(input.operation, input.subject);
  const windowEnd = new Date(now.getTime() + policy.windowMs);

  return db.transaction(async (tx) => {
    const [consumed] = await tx
      .insert(authRateLimits)
      .values({
        keyHash,
        attempts: 1,
        windowStartedAt: now,
        expiresAt: windowEnd,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: authRateLimits.keyHash,
        set: {
          attempts: sql`
            CASE
              WHEN ${authRateLimits.expiresAt} <= ${now} THEN 1
              ELSE ${authRateLimits.attempts} + 1
            END
          `,
          windowStartedAt: sql`
            CASE
              WHEN ${authRateLimits.expiresAt} <= ${now} THEN ${now}
              ELSE ${authRateLimits.windowStartedAt}
            END
          `,
          expiresAt: sql`
            CASE
              WHEN ${authRateLimits.expiresAt} <= ${now} THEN ${windowEnd}
              ELSE ${authRateLimits.expiresAt}
            END
          `,
          updatedAt: now,
        },
        setWhere: sql`
          ${authRateLimits.expiresAt} <= ${now}
          OR ${authRateLimits.attempts} < ${policy.maxAttempts}
        `,
      })
      .returning();

    if (consumed) {
      // The upsert locks the bucket and refreshes it before pruning, so a
      // concurrent consumer cannot prune the row it is about to consume.
      await pruneExpiredRateLimits(tx, now);
      return {
        allowed: true,
        limit: policy.maxAttempts,
        remaining: policy.maxAttempts - consumed.attempts,
        retryAfterSeconds: Math.max(
          1,
          Math.ceil((consumed.expiresAt.getTime() - now.getTime()) / 1000),
        ),
      };
    }

    // A false conflict predicate means the bucket is already full. Lock and
    // read it before returning the denial so the decision remains serialized
    // with consumers that are completing the same bucket transition.
    const [latest] = await tx
      .select()
      .from(authRateLimits)
      .where(eq(authRateLimits.keyHash, keyHash))
      .for("update");

    if (!latest) {
      throw new Error("Rate-limit state could not be read.");
    }

    if (latest.attempts >= policy.maxAttempts) {
      return {
        allowed: false,
        limit: policy.maxAttempts,
        remaining: 0,
        retryAfterSeconds: Math.max(
          1,
          Math.ceil((latest.expiresAt.getTime() - now.getTime()) / 1000),
        ),
      };
    }

    throw new Error("Rate-limit state could not be consumed.");
  });
}

/** Remove a bounded batch of expired buckets without touching live limits. */
export async function pruneExpiredRateLimits(
  db: RateLimitDatabase,
  now = new Date(),
): Promise<number> {
  if (!Number.isFinite(now.getTime())) {
    throw new Error("Rate-limit timestamp is invalid.");
  }

  const expired = await db
    .select({ keyHash: authRateLimits.keyHash })
    .from(authRateLimits)
    .where(lte(authRateLimits.expiresAt, now))
    .orderBy(authRateLimits.expiresAt)
    .for("update", { skipLocked: true })
    .limit(RATE_LIMIT_PRUNE_BATCH_SIZE);
  if (expired.length === 0) {
    return 0;
  }

  const deleted = await db
    .delete(authRateLimits)
    .where(
      and(
        lte(authRateLimits.expiresAt, now),
        inArray(
          authRateLimits.keyHash,
          expired.map(({ keyHash }) => keyHash),
        ),
      ),
    )
    .returning({ keyHash: authRateLimits.keyHash });
  return deleted.length;
}

export async function enforceRateLimit(
  db: Database,
  input: { operation: string; subject: string },
  policy: RateLimitPolicy,
  now = new Date(),
): Promise<RateLimitResult> {
  const result = await consumeRateLimit(db, input, policy, now);
  if (!result.allowed) {
    throw new AppError("RATE_LIMITED");
  }
  return result;
}
