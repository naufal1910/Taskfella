import { sql } from "drizzle-orm";
import {
  check,
  index,
  type AnyPgColumn,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

const utcTimestamp = (name: string) =>
  timestamp(name, {
    withTimezone: true,
    mode: "date",
  });

export const accounts = pgTable(
  "accounts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    email: text("email").notNull(),
    normalizedEmail: text("normalized_email").notNull(),
    emailVerifiedAt: utcTimestamp("email_verified_at"),
    createdAt: utcTimestamp("created_at").defaultNow().notNull(),
    updatedAt: utcTimestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("accounts_normalized_email_unique").on(table.normalizedEmail),
    check(
      "accounts_normalized_email_lowercase_check",
      sql`${table.normalizedEmail} = lower(${table.normalizedEmail})`,
    ),
  ],
);

export const passwordCredentials = pgTable(
  "password_credentials",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    accountId: uuid("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    passwordHash: text("password_hash").notNull(),
    passwordChangedAt: utcTimestamp("password_changed_at").defaultNow().notNull(),
    createdAt: utcTimestamp("created_at").defaultNow().notNull(),
    updatedAt: utcTimestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("password_credentials_account_unique").on(table.accountId),
    check("password_credentials_hash_not_empty_check", sql`length(${table.passwordHash}) > 0`),
  ],
);

/** OAuth identities are provider linkages; OAuth client secrets never belong in this table. */
export const oauthIdentities = pgTable(
  "auth_identities",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    accountId: uuid("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    provider: text("provider").notNull(),
    providerSubject: text("provider_subject").notNull(),
    createdAt: utcTimestamp("created_at").defaultNow().notNull(),
    updatedAt: utcTimestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("auth_identities_provider_subject_unique").on(
      table.provider,
      table.providerSubject,
    ),
    uniqueIndex("auth_identities_account_provider_unique").on(table.accountId, table.provider),
    index("auth_identities_account_idx").on(table.accountId),
    check("auth_identities_provider_not_empty_check", sql`length(${table.provider}) > 0`),
    check(
      "auth_identities_provider_subject_not_empty_check",
      sql`length(${table.providerSubject}) > 0`,
    ),
  ],
);

export const authIdentities = oauthIdentities;

export const sessions = pgTable(
  "sessions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    accountId: uuid("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull(),
    expiresAt: utcTimestamp("expires_at").notNull(),
    lastAccessedAt: utcTimestamp("last_accessed_at").defaultNow().notNull(),
    revokedAt: utcTimestamp("revoked_at"),
    revokedReason: text("revoked_reason"),
    replacedBySessionId: uuid("replaced_by_session_id").references((): AnyPgColumn => sessions.id, {
      onDelete: "set null",
    }),
    createdAt: utcTimestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("sessions_token_hash_unique").on(table.tokenHash),
    index("sessions_account_active_idx").on(table.accountId, table.revokedAt, table.expiresAt),
    index("sessions_expiry_idx").on(table.expiresAt),
    check("sessions_token_hash_not_empty_check", sql`length(${table.tokenHash}) > 0`),
    check("sessions_expires_after_created_check", sql`${table.expiresAt} > ${table.createdAt}`),
    check(
      "sessions_revoked_at_after_created_check",
      sql`${table.revokedAt} IS NULL OR ${table.revokedAt} >= ${table.createdAt}`,
    ),
  ],
);

export const emailVerificationTokens = pgTable(
  "email_verification_tokens",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    accountId: uuid("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull(),
    expiresAt: utcTimestamp("expires_at").notNull(),
    consumedAt: utcTimestamp("consumed_at"),
    createdAt: utcTimestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("email_verification_tokens_hash_unique").on(table.tokenHash),
    index("email_verification_tokens_account_lookup_idx").on(
      table.accountId,
      table.consumedAt,
      table.expiresAt,
    ),
    index("email_verification_tokens_expiry_idx").on(table.expiresAt),
    check("email_verification_tokens_hash_not_empty_check", sql`length(${table.tokenHash}) > 0`),
    check(
      "email_verification_tokens_expires_after_created_check",
      sql`${table.expiresAt} > ${table.createdAt}`,
    ),
    check(
      "email_verification_tokens_consumed_at_after_created_check",
      sql`${table.consumedAt} IS NULL OR ${table.consumedAt} >= ${table.createdAt}`,
    ),
  ],
);

export const passwordResetTokens = pgTable(
  "password_reset_tokens",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    accountId: uuid("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull(),
    expiresAt: utcTimestamp("expires_at").notNull(),
    consumedAt: utcTimestamp("consumed_at"),
    createdAt: utcTimestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("password_reset_tokens_hash_unique").on(table.tokenHash),
    index("password_reset_tokens_account_lookup_idx").on(
      table.accountId,
      table.consumedAt,
      table.expiresAt,
    ),
    index("password_reset_tokens_expiry_idx").on(table.expiresAt),
    check("password_reset_tokens_hash_not_empty_check", sql`length(${table.tokenHash}) > 0`),
    check(
      "password_reset_tokens_expires_after_created_check",
      sql`${table.expiresAt} > ${table.createdAt}`,
    ),
    check(
      "password_reset_tokens_consumed_at_after_created_check",
      sql`${table.consumedAt} IS NULL OR ${table.consumedAt} >= ${table.createdAt}`,
    ),
  ],
);

/**
 * The rate limiter stores a digest of an operation/subject key, never an email
 * address or IP address. Attempts are deliberately bounded by the database.
 */
export const authRateLimits = pgTable(
  "auth_rate_limits",
  {
    keyHash: text("key_hash").primaryKey(),
    attempts: integer("attempts").notNull().default(0),
    windowStartedAt: utcTimestamp("window_started_at").notNull(),
    expiresAt: utcTimestamp("expires_at").notNull(),
    updatedAt: utcTimestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("auth_rate_limits_expiry_idx").on(table.expiresAt),
    check("auth_rate_limits_key_hash_not_empty_check", sql`length(${table.keyHash}) > 0`),
    check("auth_rate_limits_attempts_bounded_check", sql`${table.attempts} BETWEEN 0 AND 1000`),
    check(
      "auth_rate_limits_expiry_after_window_start_check",
      sql`${table.expiresAt} > ${table.windowStartedAt}`,
    ),
  ],
);

export const foundationSchema = {
  accounts,
  passwordCredentials,
  oauthIdentities,
  sessions,
  emailVerificationTokens,
  passwordResetTokens,
  authRateLimits,
} as const;

export type Account = typeof accounts.$inferSelect;
export type NewAccount = typeof accounts.$inferInsert;
export type PasswordCredential = typeof passwordCredentials.$inferSelect;
export type OAuthIdentity = typeof oauthIdentities.$inferSelect;
export type Session = typeof sessions.$inferSelect;
export type EmailVerificationToken = typeof emailVerificationTokens.$inferSelect;
export type PasswordResetToken = typeof passwordResetTokens.$inferSelect;
export type AuthRateLimit = typeof authRateLimits.$inferSelect;
