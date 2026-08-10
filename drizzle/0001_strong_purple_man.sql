CREATE TABLE "accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"normalized_email" text NOT NULL,
	"email_verified_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "accounts_normalized_email_lowercase_check" CHECK ("accounts"."normalized_email" = lower("accounts"."normalized_email"))
);
--> statement-breakpoint
CREATE TABLE "auth_rate_limits" (
	"key_hash" text PRIMARY KEY NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"window_started_at" timestamp with time zone NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "auth_rate_limits_key_hash_not_empty_check" CHECK (length("auth_rate_limits"."key_hash") > 0),
	CONSTRAINT "auth_rate_limits_attempts_bounded_check" CHECK ("auth_rate_limits"."attempts" BETWEEN 0 AND 1000),
	CONSTRAINT "auth_rate_limits_expiry_after_window_start_check" CHECK ("auth_rate_limits"."expires_at" > "auth_rate_limits"."window_started_at")
);
--> statement-breakpoint
CREATE TABLE "email_verification_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"consumed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "email_verification_tokens_hash_not_empty_check" CHECK (length("email_verification_tokens"."token_hash") > 0),
	CONSTRAINT "email_verification_tokens_expires_after_created_check" CHECK ("email_verification_tokens"."expires_at" > "email_verification_tokens"."created_at"),
	CONSTRAINT "email_verification_tokens_consumed_at_after_created_check" CHECK ("email_verification_tokens"."consumed_at" IS NULL OR "email_verification_tokens"."consumed_at" >= "email_verification_tokens"."created_at")
);
--> statement-breakpoint
CREATE TABLE "auth_identities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"provider" text NOT NULL,
	"provider_subject" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "auth_identities_provider_not_empty_check" CHECK (length("auth_identities"."provider") > 0),
	CONSTRAINT "auth_identities_provider_subject_not_empty_check" CHECK (length("auth_identities"."provider_subject") > 0)
);
--> statement-breakpoint
CREATE TABLE "password_credentials" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"password_hash" text NOT NULL,
	"password_changed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "password_credentials_hash_not_empty_check" CHECK (length("password_credentials"."password_hash") > 0)
);
--> statement-breakpoint
CREATE TABLE "password_reset_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"consumed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "password_reset_tokens_hash_not_empty_check" CHECK (length("password_reset_tokens"."token_hash") > 0),
	CONSTRAINT "password_reset_tokens_expires_after_created_check" CHECK ("password_reset_tokens"."expires_at" > "password_reset_tokens"."created_at"),
	CONSTRAINT "password_reset_tokens_consumed_at_after_created_check" CHECK ("password_reset_tokens"."consumed_at" IS NULL OR "password_reset_tokens"."consumed_at" >= "password_reset_tokens"."created_at")
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"last_accessed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revoked_at" timestamp with time zone,
	"revoked_reason" text,
	"replaced_by_session_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sessions_token_hash_not_empty_check" CHECK (length("sessions"."token_hash") > 0),
	CONSTRAINT "sessions_expires_after_created_check" CHECK ("sessions"."expires_at" > "sessions"."created_at"),
	CONSTRAINT "sessions_revoked_at_after_created_check" CHECK ("sessions"."revoked_at" IS NULL OR "sessions"."revoked_at" >= "sessions"."created_at")
);
--> statement-breakpoint
ALTER TABLE "email_verification_tokens" ADD CONSTRAINT "email_verification_tokens_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth_identities" ADD CONSTRAINT "auth_identities_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "password_credentials" ADD CONSTRAINT "password_credentials_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "accounts_normalized_email_unique" ON "accounts" USING btree ("normalized_email");--> statement-breakpoint
CREATE INDEX "auth_rate_limits_expiry_idx" ON "auth_rate_limits" USING btree ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "email_verification_tokens_hash_unique" ON "email_verification_tokens" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "email_verification_tokens_account_lookup_idx" ON "email_verification_tokens" USING btree ("account_id","consumed_at","expires_at");--> statement-breakpoint
CREATE INDEX "email_verification_tokens_expiry_idx" ON "email_verification_tokens" USING btree ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "auth_identities_provider_subject_unique" ON "auth_identities" USING btree ("provider","provider_subject");--> statement-breakpoint
CREATE UNIQUE INDEX "auth_identities_account_provider_unique" ON "auth_identities" USING btree ("account_id","provider");--> statement-breakpoint
CREATE INDEX "auth_identities_account_idx" ON "auth_identities" USING btree ("account_id");--> statement-breakpoint
CREATE UNIQUE INDEX "password_credentials_account_unique" ON "password_credentials" USING btree ("account_id");--> statement-breakpoint
CREATE UNIQUE INDEX "password_reset_tokens_hash_unique" ON "password_reset_tokens" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "password_reset_tokens_account_lookup_idx" ON "password_reset_tokens" USING btree ("account_id","consumed_at","expires_at");--> statement-breakpoint
CREATE INDEX "password_reset_tokens_expiry_idx" ON "password_reset_tokens" USING btree ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "sessions_token_hash_unique" ON "sessions" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "sessions_account_active_idx" ON "sessions" USING btree ("account_id","revoked_at","expires_at");--> statement-breakpoint
CREATE INDEX "sessions_expiry_idx" ON "sessions" USING btree ("expires_at");