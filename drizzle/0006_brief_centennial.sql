CREATE TABLE "paths" (
	"id" serial PRIMARY KEY NOT NULL,
	"session_id" integer NOT NULL,
	"steps" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"revealed_tiles" text[] DEFAULT '{}' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" serial PRIMARY KEY NOT NULL,
	"campaign_id" integer NOT NULL,
	"session_number" integer NOT NULL,
	"name" text NOT NULL,
	"start_game_time" double precision NOT NULL,
	"end_game_time" double precision,
	"started_at" timestamp DEFAULT now() NOT NULL,
	"ended_at" timestamp,
	"duration" integer,
	"is_active" boolean DEFAULT true NOT NULL,
	"last_activity_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "time_audit_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"campaign_id" integer NOT NULL,
	"timestamp" timestamp DEFAULT now() NOT NULL,
	"type" text NOT NULL,
	"amount" double precision NOT NULL,
	"actor_role" text NOT NULL,
	"notes" text
);
--> statement-breakpoint
ALTER TABLE "campaigns" ADD COLUMN "global_game_time" double precision DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "campaigns" ADD COLUMN "party_token_x" integer;--> statement-breakpoint
ALTER TABLE "campaigns" ADD COLUMN "party_token_y" integer;--> statement-breakpoint
ALTER TABLE "paths" ADD CONSTRAINT "paths_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "time_audit_log" ADD CONSTRAINT "time_audit_log_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE cascade ON UPDATE no action;