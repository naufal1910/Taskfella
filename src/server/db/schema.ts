import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  type AnyPgColumn,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  foreignKey,
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
    displayName: text("display_name").notNull().default(""),
    timezone: text("timezone").notNull().default("UTC"),
    appearance: text("appearance").notNull().default("system"),
    appearanceRevision: integer("appearance_revision").notNull().default(0),
    notificationsEnabled: boolean("notifications_enabled").notNull().default(true),
    soundEnabled: boolean("sound_enabled").notNull().default(true),
    focusDurationMinutes: integer("focus_duration_minutes").notNull().default(25),
    shortBreakDurationMinutes: integer("short_break_duration_minutes").notNull().default(5),
    longBreakDurationMinutes: integer("long_break_duration_minutes").notNull().default(15),
    longBreakInterval: integer("long_break_interval").notNull().default(4),
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
    check("accounts_display_name_length_check", sql`length(${table.displayName}) <= 80`),
    check(
      "accounts_appearance_value_check",
      sql`${table.appearance} IN ('system', 'light', 'dark')`,
    ),
    check(
      "accounts_focus_duration_minutes_check",
      sql`${table.focusDurationMinutes} BETWEEN 1 AND 120`,
    ),
    check(
      "accounts_short_break_duration_minutes_check",
      sql`${table.shortBreakDurationMinutes} BETWEEN 1 AND 60`,
    ),
    check(
      "accounts_long_break_duration_minutes_check",
      sql`${table.longBreakDurationMinutes} BETWEEN 1 AND 120`,
    ),
    check("accounts_long_break_interval_check", sql`${table.longBreakInterval} BETWEEN 1 AND 12`),
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

export const oauthTransactions = pgTable(
  "oauth_transactions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    provider: text("provider").notNull(),
    stateHash: text("state_hash").notNull(),
    codeVerifierHash: text("code_verifier_hash").notNull(),
    intent: text("intent").notNull(),
    accountId: uuid("account_id").references(() => accounts.id, { onDelete: "cascade" }),
    sessionId: uuid("session_id").references(() => sessions.id, { onDelete: "cascade" }),
    expiresAt: utcTimestamp("expires_at").notNull(),
    consumedAt: utcTimestamp("consumed_at"),
    createdAt: utcTimestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("oauth_transactions_state_hash_unique").on(table.stateHash),
    index("oauth_transactions_expiry_idx").on(table.expiresAt),
    check("oauth_transactions_provider_not_empty_check", sql`length(${table.provider}) > 0`),
    check("oauth_transactions_state_hash_not_empty_check", sql`length(${table.stateHash}) > 0`),
    check(
      "oauth_transactions_code_verifier_hash_not_empty_check",
      sql`length(${table.codeVerifierHash}) > 0`,
    ),
    check("oauth_transactions_intent_check", sql`${table.intent} IN ('signin', 'link')`),
    check(
      "oauth_transactions_expires_after_created_check",
      sql`${table.expiresAt} > ${table.createdAt}`,
    ),
    check(
      "oauth_transactions_consumed_at_after_created_check",
      sql`${table.consumedAt} IS NULL OR ${table.consumedAt} >= ${table.createdAt}`,
    ),
    check(
      "oauth_transactions_link_binding_check",
      sql`${table.intent} = 'signin' OR (${table.accountId} IS NOT NULL AND ${table.sessionId} IS NOT NULL)`,
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
    invalidatedAt: utcTimestamp("invalidated_at"),
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
    check(
      "email_verification_tokens_invalidated_at_after_created_check",
      sql`${table.invalidatedAt} IS NULL OR ${table.invalidatedAt} >= ${table.createdAt}`,
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
    invalidatedAt: utcTimestamp("invalidated_at"),
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
    check(
      "password_reset_tokens_invalidated_at_after_created_check",
      sql`${table.invalidatedAt} IS NULL OR ${table.invalidatedAt} >= ${table.createdAt}`,
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

export const projects = pgTable(
  "projects",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    accountId: uuid("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    status: text("status").notNull().default("active"),
    position: integer("position").notNull().default(0),
    revision: integer("revision").notNull().default(0),
    archivedAt: utcTimestamp("archived_at"),
    createdAt: utcTimestamp("created_at").defaultNow().notNull(),
    updatedAt: utcTimestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("projects_account_status_position_idx").on(table.accountId, table.status, table.position),
    index("projects_account_updated_idx").on(table.accountId, table.updatedAt),
    uniqueIndex("projects_id_account_unique").on(table.id, table.accountId),
    check("projects_name_length_check", sql`length(trim(${table.name})) BETWEEN 1 AND 120`),
    check("projects_description_length_check", sql`length(${table.description}) <= 20000`),
    check("projects_status_value_check", sql`${table.status} IN ('active', 'archived')`),
    check("projects_position_nonnegative_check", sql`${table.position} >= 0`),
    check("projects_revision_nonnegative_check", sql`${table.revision} >= 0`),
    check(
      "projects_archive_state_check",
      sql`(${table.status} = 'active' AND ${table.archivedAt} IS NULL) OR (${table.status} = 'archived' AND ${table.archivedAt} IS NOT NULL)`,
    ),
  ],
);

export const columns = pgTable(
  "columns",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    role: text("role").notNull().default("neutral"),
    position: integer("position").notNull().default(0),
    wipMode: text("wip_mode").notNull().default("none"),
    wipLimit: integer("wip_limit"),
    completedGrouping: text("completed_grouping").notNull().default("list"),
    createdAt: utcTimestamp("created_at").defaultNow().notNull(),
    updatedAt: utcTimestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("columns_project_position_idx").on(table.projectId, table.position),
    index("columns_project_role_idx").on(table.projectId, table.role),
    uniqueIndex("columns_one_active_per_project_unique")
      .on(table.projectId)
      .where(sql`${table.role} = 'active'`),
    check("columns_name_length_check", sql`length(trim(${table.name})) BETWEEN 1 AND 80`),
    check(
      "columns_role_value_check",
      sql`${table.role} IN ('queued', 'planned', 'active', 'review', 'completed', 'neutral')`,
    ),
    check("columns_position_nonnegative_check", sql`${table.position} >= 0`),
    check("columns_wip_mode_value_check", sql`${table.wipMode} IN ('none', 'warn', 'enforce')`),
    check(
      "columns_wip_limit_consistency_check",
      sql`(${table.wipMode} = 'none' AND ${table.wipLimit} IS NULL) OR (${table.wipMode} IN ('warn', 'enforce') AND ${table.wipLimit} IS NOT NULL AND ${table.wipLimit} BETWEEN 1 AND 1000000)`,
    ),
    check(
      "columns_completed_grouping_value_check",
      sql`${table.completedGrouping} IN ('list', 'date')`,
    ),
  ],
);

export const projectColumns = columns;

export const swimlanes = pgTable(
  "swimlanes",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    position: integer("position").notNull().default(0),
    createdAt: utcTimestamp("created_at").defaultNow().notNull(),
    updatedAt: utcTimestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("swimlanes_project_position_idx").on(table.projectId, table.position),
    check("swimlanes_name_length_check", sql`length(trim(${table.name})) BETWEEN 1 AND 80`),
    check("swimlanes_position_nonnegative_check", sql`${table.position} >= 0`),
  ],
);

export const labels = pgTable(
  "labels",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    normalizedName: text("normalized_name").notNull(),
    color: text("color").notNull().default("#0F766E"),
    position: integer("position").notNull().default(0),
    createdAt: utcTimestamp("created_at").defaultNow().notNull(),
    updatedAt: utcTimestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("labels_project_normalized_name_unique").on(table.projectId, table.normalizedName),
    index("labels_project_position_idx").on(table.projectId, table.position),
    check("labels_name_length_check", sql`length(trim(${table.name})) BETWEEN 1 AND 60`),
    check(
      "labels_normalized_name_length_check",
      sql`length(${table.normalizedName}) BETWEEN 1 AND 60`,
    ),
    check(
      "labels_normalized_name_lowercase_check",
      sql`${table.normalizedName} = lower(${table.normalizedName})`,
    ),
    check("labels_color_hex_check", sql`${table.color} ~ '^#[0-9A-Fa-f]{6}$'`),
    check("labels_position_nonnegative_check", sql`${table.position} >= 0`),
  ],
);

export const projectLifecycleEvents = pgTable(
  "project_lifecycle_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    accountId: uuid("account_id").notNull(),
    event: text("event").notNull(),
    createdAt: utcTimestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("project_lifecycle_events_project_created_idx").on(table.projectId, table.createdAt),
    index("project_lifecycle_events_account_created_idx").on(table.accountId, table.createdAt),
    foreignKey({
      columns: [table.projectId, table.accountId],
      foreignColumns: [projects.id, projects.accountId],
      name: "project_lifecycle_events_project_owner_fk",
    }).onDelete("cascade"),
    check(
      "project_lifecycle_events_event_value_check",
      sql`${table.event} IN ('created', 'archived', 'restored')`,
    ),
  ],
);

export const foundationSchema = {
  accounts,
  passwordCredentials,
  oauthIdentities,
  sessions,
  oauthTransactions,
  emailVerificationTokens,
  passwordResetTokens,
  authRateLimits,
  projects,
  columns,
  swimlanes,
  labels,
  projectLifecycleEvents,
} as const;

export type Account = typeof accounts.$inferSelect;
export type NewAccount = typeof accounts.$inferInsert;
export type PasswordCredential = typeof passwordCredentials.$inferSelect;
export type OAuthIdentity = typeof oauthIdentities.$inferSelect;
export type Session = typeof sessions.$inferSelect;
export type OAuthTransaction = typeof oauthTransactions.$inferSelect;
export type EmailVerificationToken = typeof emailVerificationTokens.$inferSelect;
export type PasswordResetToken = typeof passwordResetTokens.$inferSelect;
export type AuthRateLimit = typeof authRateLimits.$inferSelect;
export type Project = typeof projects.$inferSelect;
export type NewProject = typeof projects.$inferInsert;
export type ProjectColumn = typeof columns.$inferSelect;
export type Swimlane = typeof swimlanes.$inferSelect;
export type Label = typeof labels.$inferSelect;
export type ProjectLifecycleEvent = typeof projectLifecycleEvents.$inferSelect;
