ALTER TABLE "accounts" ADD COLUMN "display_name" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "timezone" text DEFAULT 'UTC' NOT NULL;--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "appearance" text DEFAULT 'system' NOT NULL;--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "notifications_enabled" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "sound_enabled" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "focus_duration_minutes" integer DEFAULT 25 NOT NULL;--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "short_break_duration_minutes" integer DEFAULT 5 NOT NULL;--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "long_break_duration_minutes" integer DEFAULT 15 NOT NULL;--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "long_break_interval" integer DEFAULT 4 NOT NULL;--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_display_name_length_check" CHECK (length("accounts"."display_name") <= 80);--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_appearance_value_check" CHECK ("accounts"."appearance" IN ('system', 'light', 'dark'));--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_focus_duration_minutes_check" CHECK ("accounts"."focus_duration_minutes" BETWEEN 1 AND 120);--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_short_break_duration_minutes_check" CHECK ("accounts"."short_break_duration_minutes" BETWEEN 1 AND 60);--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_long_break_duration_minutes_check" CHECK ("accounts"."long_break_duration_minutes" BETWEEN 1 AND 120);--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_long_break_interval_check" CHECK ("accounts"."long_break_interval" BETWEEN 1 AND 12);