CREATE TABLE "columns" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"name" text NOT NULL,
	"role" text DEFAULT 'neutral' NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"wip_mode" text DEFAULT 'none' NOT NULL,
	"wip_limit" integer,
	"completed_grouping" text DEFAULT 'list' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "columns_name_length_check" CHECK (length(trim("columns"."name")) BETWEEN 1 AND 80),
	CONSTRAINT "columns_role_value_check" CHECK ("columns"."role" IN ('queued', 'planned', 'active', 'review', 'completed', 'neutral')),
	CONSTRAINT "columns_position_nonnegative_check" CHECK ("columns"."position" >= 0),
	CONSTRAINT "columns_wip_mode_value_check" CHECK ("columns"."wip_mode" IN ('none', 'warn', 'enforce')),
	CONSTRAINT "columns_wip_limit_consistency_check" CHECK (("columns"."wip_mode" = 'none' AND "columns"."wip_limit" IS NULL) OR ("columns"."wip_mode" IN ('warn', 'enforce') AND "columns"."wip_limit" IS NOT NULL AND "columns"."wip_limit" BETWEEN 1 AND 1000000)),
	CONSTRAINT "columns_completed_grouping_value_check" CHECK ("columns"."completed_grouping" IN ('list', 'date'))
);
--> statement-breakpoint
CREATE TABLE "labels" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"name" text NOT NULL,
	"normalized_name" text NOT NULL,
	"color" text DEFAULT '#0F766E' NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "labels_name_length_check" CHECK (length(trim("labels"."name")) BETWEEN 1 AND 60),
	CONSTRAINT "labels_normalized_name_length_check" CHECK (length("labels"."normalized_name") BETWEEN 1 AND 60),
	CONSTRAINT "labels_color_hex_check" CHECK ("labels"."color" ~ '^#[0-9A-Fa-f]{6}$'),
	CONSTRAINT "labels_position_nonnegative_check" CHECK ("labels"."position" >= 0)
);
--> statement-breakpoint
CREATE TABLE "project_lifecycle_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"account_id" uuid NOT NULL,
	"event" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "project_lifecycle_events_event_value_check" CHECK ("project_lifecycle_events"."event" IN ('created', 'archived', 'restored'))
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"revision" integer DEFAULT 0 NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "projects_name_length_check" CHECK (length(trim("projects"."name")) BETWEEN 1 AND 120),
	CONSTRAINT "projects_description_length_check" CHECK (length("projects"."description") <= 20000),
	CONSTRAINT "projects_status_value_check" CHECK ("projects"."status" IN ('active', 'archived')),
	CONSTRAINT "projects_position_nonnegative_check" CHECK ("projects"."position" >= 0),
	CONSTRAINT "projects_revision_nonnegative_check" CHECK ("projects"."revision" >= 0),
	CONSTRAINT "projects_archive_state_check" CHECK (("projects"."status" = 'active' AND "projects"."archived_at" IS NULL) OR ("projects"."status" = 'archived' AND "projects"."archived_at" IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE "swimlanes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"name" text NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "swimlanes_name_length_check" CHECK (length(trim("swimlanes"."name")) BETWEEN 1 AND 80),
	CONSTRAINT "swimlanes_position_nonnegative_check" CHECK ("swimlanes"."position" >= 0)
);
--> statement-breakpoint
ALTER TABLE "columns" ADD CONSTRAINT "columns_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "labels" ADD CONSTRAINT "labels_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_lifecycle_events" ADD CONSTRAINT "project_lifecycle_events_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_lifecycle_events" ADD CONSTRAINT "project_lifecycle_events_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "swimlanes" ADD CONSTRAINT "swimlanes_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "columns_project_position_idx" ON "columns" USING btree ("project_id","position");--> statement-breakpoint
CREATE INDEX "columns_project_role_idx" ON "columns" USING btree ("project_id","role");--> statement-breakpoint
CREATE UNIQUE INDEX "columns_one_active_per_project_unique" ON "columns" USING btree ("project_id") WHERE "columns"."role" = 'active';--> statement-breakpoint
CREATE UNIQUE INDEX "labels_project_normalized_name_unique" ON "labels" USING btree ("project_id","normalized_name");--> statement-breakpoint
CREATE INDEX "labels_project_position_idx" ON "labels" USING btree ("project_id","position");--> statement-breakpoint
CREATE INDEX "project_lifecycle_events_project_created_idx" ON "project_lifecycle_events" USING btree ("project_id","created_at");--> statement-breakpoint
CREATE INDEX "project_lifecycle_events_account_created_idx" ON "project_lifecycle_events" USING btree ("account_id","created_at");--> statement-breakpoint
CREATE INDEX "projects_account_status_position_idx" ON "projects" USING btree ("account_id","status","position");--> statement-breakpoint
CREATE INDEX "projects_account_updated_idx" ON "projects" USING btree ("account_id","updated_at");--> statement-breakpoint
CREATE INDEX "swimlanes_project_position_idx" ON "swimlanes" USING btree ("project_id","position");--> statement-breakpoint

-- Workflow invariants are checked at transaction end so role changes can be
-- applied as one coherent operation while concurrent transactions serialize
-- on the owning project row.
CREATE OR REPLACE FUNCTION taskfella_validate_project_workflow()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  project_key uuid;
  active_count integer;
  completed_count integer;
BEGIN
  project_key := COALESCE(NEW.project_id, OLD.project_id);
  IF NOT EXISTS (SELECT 1 FROM "projects" WHERE "id" = project_key) THEN
    RETURN NULL;
  END IF;

  PERFORM 1 FROM "projects" WHERE "id" = project_key FOR UPDATE;
  SELECT
    count(*) FILTER (WHERE "role" = 'active'),
    count(*) FILTER (WHERE "role" = 'completed')
  INTO active_count, completed_count
  FROM "columns"
  WHERE "project_id" = project_key;

  IF active_count <> 1 OR completed_count < 1 THEN
    RAISE EXCEPTION 'Project workflow must have exactly one active column and at least one completed column'
      USING ERRCODE = '23514', CONSTRAINT = 'columns_workflow_invariant_check';
  END IF;
  RETURN NULL;
END;
$$;--> statement-breakpoint
CREATE OR REPLACE FUNCTION taskfella_validate_project_row_workflow()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  active_count integer;
  completed_count integer;
BEGIN
  PERFORM 1 FROM "projects" WHERE "id" = NEW.id FOR UPDATE;
  SELECT
    count(*) FILTER (WHERE "role" = 'active'),
    count(*) FILTER (WHERE "role" = 'completed')
  INTO active_count, completed_count
  FROM "columns"
  WHERE "project_id" = NEW.id;

  IF active_count <> 1 OR completed_count < 1 THEN
    RAISE EXCEPTION 'Project workflow must have exactly one active column and at least one completed column'
      USING ERRCODE = '23514', CONSTRAINT = 'columns_workflow_invariant_check';
  END IF;
  RETURN NULL;
END;
$$;--> statement-breakpoint
CREATE CONSTRAINT TRIGGER columns_workflow_invariant_trigger
AFTER INSERT OR UPDATE OR DELETE ON "columns"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION taskfella_validate_project_workflow();--> statement-breakpoint
CREATE CONSTRAINT TRIGGER projects_workflow_invariant_trigger
AFTER INSERT ON "projects"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION taskfella_validate_project_row_workflow();