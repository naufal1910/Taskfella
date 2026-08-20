CREATE TABLE "oauth_transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider" text NOT NULL,
	"state_hash" text NOT NULL,
	"code_verifier_hash" text NOT NULL,
	"intent" text NOT NULL,
	"account_id" uuid,
	"session_id" uuid,
	"expires_at" timestamp with time zone NOT NULL,
	"consumed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "oauth_transactions_provider_not_empty_check" CHECK (length("oauth_transactions"."provider") > 0),
	CONSTRAINT "oauth_transactions_state_hash_not_empty_check" CHECK (length("oauth_transactions"."state_hash") > 0),
	CONSTRAINT "oauth_transactions_code_verifier_hash_not_empty_check" CHECK (length("oauth_transactions"."code_verifier_hash") > 0),
	CONSTRAINT "oauth_transactions_intent_check" CHECK ("oauth_transactions"."intent" IN ('signin', 'link')),
	CONSTRAINT "oauth_transactions_expires_after_created_check" CHECK ("oauth_transactions"."expires_at" > "oauth_transactions"."created_at"),
	CONSTRAINT "oauth_transactions_consumed_at_after_created_check" CHECK ("oauth_transactions"."consumed_at" IS NULL OR "oauth_transactions"."consumed_at" >= "oauth_transactions"."created_at"),
	CONSTRAINT "oauth_transactions_link_binding_check" CHECK ("oauth_transactions"."intent" = 'signin' OR ("oauth_transactions"."account_id" IS NOT NULL AND "oauth_transactions"."session_id" IS NOT NULL))
);
--> statement-breakpoint
ALTER TABLE "oauth_transactions" ADD CONSTRAINT "oauth_transactions_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "oauth_transactions" ADD CONSTRAINT "oauth_transactions_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "oauth_transactions_state_hash_unique" ON "oauth_transactions" USING btree ("state_hash");--> statement-breakpoint
CREATE INDEX "oauth_transactions_expiry_idx" ON "oauth_transactions" USING btree ("expires_at");