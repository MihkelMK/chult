CREATE TABLE "campaigns" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"dm_token" text NOT NULL,
	"player_token" text NOT NULL,
	"hexes_per_row" integer DEFAULT 20 NOT NULL,
	"hexes_per_col" integer DEFAULT 20 NOT NULL,
	"hex_offset_x" integer DEFAULT 70 NOT NULL,
	"hex_offset_y" integer DEFAULT 58 NOT NULL,
	"image_width" integer DEFAULT 0 NOT NULL,
	"image_height" integer DEFAULT 0 NOT NULL,
	"global_game_time" double precision DEFAULT 0 NOT NULL,
	"party_token_x" integer,
	"party_token_y" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "campaigns_slug_unique" UNIQUE("slug"),
	CONSTRAINT "campaigns_dm_token_unique" UNIQUE("dm_token"),
	CONSTRAINT "campaigns_player_token_unique" UNIQUE("player_token")
);
--> statement-breakpoint
CREATE TABLE "gameSessions" (
	"id" serial PRIMARY KEY NOT NULL,
	"campaign_id" integer NOT NULL,
	"session_number" integer NOT NULL,
	"name" text NOT NULL,
	"start_game_time" double precision NOT NULL,
	"end_game_time" double precision,
	"started_at" timestamp DEFAULT now() NOT NULL,
	"ended_at" timestamp,
	"duration" integer,
	"is_active" boolean DEFAULT false NOT NULL,
	"last_activity_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "map_markers" (
	"id" serial PRIMARY KEY NOT NULL,
	"campaign_id" integer NOT NULL,
	"x" integer NOT NULL,
	"y" integer NOT NULL,
	"type" text NOT NULL,
	"title" text,
	"content" text,
	"image_path" text,
	"author_role" text NOT NULL,
	"visible_to_players" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "navigation_paths" (
	"id" serial PRIMARY KEY NOT NULL,
	"gameSession_id" integer NOT NULL,
	"x" integer NOT NULL,
	"y" integer NOT NULL,
	"timestamp" timestamp DEFAULT now() NOT NULL,
	"path_group" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "paths" (
	"id" serial PRIMARY KEY NOT NULL,
	"game_session_id" integer NOT NULL,
	"steps" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"revealed_tiles" text[] DEFAULT '{}' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "revealed_tiles" (
	"id" serial PRIMARY KEY NOT NULL,
	"campaign_id" integer NOT NULL,
	"x" integer NOT NULL,
	"y" integer NOT NULL,
	"always_revealed" boolean DEFAULT false NOT NULL,
	"revealed_at" timestamp DEFAULT now() NOT NULL
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
CREATE TABLE "uploaded_images" (
	"id" serial PRIMARY KEY NOT NULL,
	"campaign_id" integer NOT NULL,
	"filename" text NOT NULL,
	"original_filename" text NOT NULL,
	"file_size" integer NOT NULL,
	"mime_type" text NOT NULL,
	"upload_timestamp" timestamp DEFAULT now() NOT NULL,
	"uploaded_by" text NOT NULL,
	"associated_table" text NOT NULL,
	"associated_id" integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE "gameSessions" ADD CONSTRAINT "gameSessions_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "map_markers" ADD CONSTRAINT "map_markers_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "navigation_paths" ADD CONSTRAINT "navigation_paths_gameSession_id_gameSessions_id_fk" FOREIGN KEY ("gameSession_id") REFERENCES "public"."gameSessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "paths" ADD CONSTRAINT "paths_game_session_id_gameSessions_id_fk" FOREIGN KEY ("game_session_id") REFERENCES "public"."gameSessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "revealed_tiles" ADD CONSTRAINT "revealed_tiles_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "time_audit_log" ADD CONSTRAINT "time_audit_log_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "uploaded_images" ADD CONSTRAINT "uploaded_images_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "campaigns_slug_idx" ON "campaigns" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "campaigns_dm_token_idx" ON "campaigns" USING btree ("dm_token");--> statement-breakpoint
CREATE INDEX "campaigns_player_token_idx" ON "campaigns" USING btree ("player_token");--> statement-breakpoint
CREATE INDEX "game_sessions_campaign_id_idx" ON "gameSessions" USING btree ("campaign_id");--> statement-breakpoint
CREATE INDEX "game_sessions_campaign_id_is_active_idx" ON "gameSessions" USING btree ("campaign_id","is_active");--> statement-breakpoint
CREATE INDEX "game_sessions_campaign_id_session_number_idx" ON "gameSessions" USING btree ("campaign_id","session_number");--> statement-breakpoint
CREATE INDEX "map_markers_campaign_id_idx" ON "map_markers" USING btree ("campaign_id");--> statement-breakpoint
CREATE INDEX "paths_game_session_id_idx" ON "paths" USING btree ("game_session_id");--> statement-breakpoint
CREATE INDEX "revealed_tiles_campaign_id_idx" ON "revealed_tiles" USING btree ("campaign_id");--> statement-breakpoint
CREATE INDEX "time_audit_log_campaign_id_idx" ON "time_audit_log" USING btree ("campaign_id");--> statement-breakpoint
CREATE INDEX "time_audit_log_campaign_id_timestamp_idx" ON "time_audit_log" USING btree ("campaign_id","timestamp");