CREATE TABLE "notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"task_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"account_id" uuid NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "notes_body_length_check" CHECK (length(trim("notes"."body")) BETWEEN 1 AND 20000)
);
--> statement-breakpoint
CREATE TABLE "subtasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"task_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"account_id" uuid NOT NULL,
	"text" text NOT NULL,
	"completed" boolean DEFAULT false NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "subtasks_text_length_check" CHECK (length(trim("subtasks"."text")) BETWEEN 1 AND 500),
	CONSTRAINT "subtasks_position_nonnegative_check" CHECK ("subtasks"."position" >= 0)
);
--> statement-breakpoint
CREATE TABLE "task_labels" (
	"task_id" uuid NOT NULL,
	"label_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"account_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "columns_id_project_unique" ON "columns" USING btree ("id","project_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "labels_id_project_unique" ON "labels" USING btree ("id","project_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "swimlanes_id_project_unique" ON "swimlanes" USING btree ("id","project_id");
--> statement-breakpoint
CREATE TABLE "task_lifecycle_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"task_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"account_id" uuid NOT NULL,
	"event" text NOT NULL,
	"from_column_id" uuid,
	"to_column_id" uuid,
	"from_swimlane_id" uuid,
	"to_swimlane_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "task_lifecycle_events_event_value_check" CHECK ("task_lifecycle_events"."event" IN ('created', 'moved', 'completed', 'reopened', 'trashed', 'restored'))
);
--> statement-breakpoint
CREATE TABLE "tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"column_id" uuid NOT NULL,
	"swimlane_id" uuid,
	"title" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"color" text,
	"due_date" date,
	"position" integer DEFAULT 0 NOT NULL,
	"revision" integer DEFAULT 0 NOT NULL,
	"completed_at" timestamp with time zone,
	"deleted_at" timestamp with time zone,
	"restore_column_id" uuid,
	"restore_swimlane_id" uuid,
	"restore_position" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tasks_title_length_check" CHECK (length(trim("tasks"."title")) BETWEEN 1 AND 240),
	CONSTRAINT "tasks_description_length_check" CHECK (length("tasks"."description") <= 50000),
	CONSTRAINT "tasks_color_hex_check" CHECK ("tasks"."color" IS NULL OR "tasks"."color" ~ '^#[0-9A-Fa-f]{6}$'),
	CONSTRAINT "tasks_position_nonnegative_check" CHECK ("tasks"."position" >= 0),
	CONSTRAINT "tasks_revision_nonnegative_check" CHECK ("tasks"."revision" >= 0),
	CONSTRAINT "tasks_restore_position_check" CHECK ("tasks"."restore_position" IS NULL OR "tasks"."restore_position" >= 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX "tasks_id_project_account_unique" ON "tasks" USING btree ("id","project_id","account_id");
--> statement-breakpoint
ALTER TABLE "notes" ADD CONSTRAINT "notes_task_owner_fk" FOREIGN KEY ("task_id","project_id","account_id") REFERENCES "public"."tasks"("id","project_id","account_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subtasks" ADD CONSTRAINT "subtasks_task_owner_fk" FOREIGN KEY ("task_id","project_id","account_id") REFERENCES "public"."tasks"("id","project_id","account_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_labels" ADD CONSTRAINT "task_labels_task_owner_fk" FOREIGN KEY ("task_id","project_id","account_id") REFERENCES "public"."tasks"("id","project_id","account_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_labels" ADD CONSTRAINT "task_labels_label_project_fk" FOREIGN KEY ("label_id","project_id") REFERENCES "public"."labels"("id","project_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_lifecycle_events" ADD CONSTRAINT "task_lifecycle_events_task_owner_fk" FOREIGN KEY ("task_id","project_id","account_id") REFERENCES "public"."tasks"("id","project_id","account_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_project_owner_fk" FOREIGN KEY ("project_id","account_id") REFERENCES "public"."projects"("id","account_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_column_project_fk" FOREIGN KEY ("column_id","project_id") REFERENCES "public"."columns"("id","project_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_swimlane_project_fk" FOREIGN KEY ("swimlane_id","project_id") REFERENCES "public"."swimlanes"("id","project_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "notes_task_chronological_idx" ON "notes" USING btree ("task_id","created_at","id");--> statement-breakpoint
CREATE UNIQUE INDEX "notes_id_task_unique" ON "notes" USING btree ("id","task_id");--> statement-breakpoint
CREATE INDEX "subtasks_task_position_idx" ON "subtasks" USING btree ("task_id","position");--> statement-breakpoint
CREATE UNIQUE INDEX "subtasks_task_id_unique" ON "subtasks" USING btree ("id","task_id");--> statement-breakpoint
CREATE UNIQUE INDEX "task_labels_task_label_unique" ON "task_labels" USING btree ("task_id","label_id");--> statement-breakpoint
CREATE INDEX "task_labels_project_label_idx" ON "task_labels" USING btree ("project_id","label_id");--> statement-breakpoint
CREATE INDEX "task_lifecycle_events_task_created_idx" ON "task_lifecycle_events" USING btree ("task_id","created_at");--> statement-breakpoint
CREATE INDEX "task_lifecycle_events_account_created_idx" ON "task_lifecycle_events" USING btree ("account_id","created_at");--> statement-breakpoint
CREATE INDEX "tasks_project_column_lane_order_idx" ON "tasks" USING btree ("project_id","column_id","swimlane_id","position");--> statement-breakpoint
CREATE INDEX "tasks_account_deleted_updated_idx" ON "tasks" USING btree ("account_id","deleted_at","updated_at");--> statement-breakpoint
CREATE INDEX "tasks_project_due_date_idx" ON "tasks" USING btree ("project_id","due_date");--> statement-breakpoint
CREATE UNIQUE INDEX "tasks_active_location_position_unique" ON "tasks" USING btree ("project_id","column_id",coalesce("swimlane_id", '00000000-0000-0000-0000-000000000000'::uuid),"position") WHERE "tasks"."deleted_at" IS NULL;--> statement-breakpoint
