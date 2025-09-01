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
ALTER TABLE "points_of_interest" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "tile_notes" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "points_of_interest" CASCADE;--> statement-breakpoint
DROP TABLE "tile_notes" CASCADE;--> statement-breakpoint
ALTER TABLE "sessions" RENAME TO "gameSessions";--> statement-breakpoint
ALTER TABLE "navigation_paths" RENAME COLUMN "session_id" TO "gameSession_id";--> statement-breakpoint
ALTER TABLE "navigation_paths" DROP CONSTRAINT "navigation_paths_session_id_sessions_id_fk";
--> statement-breakpoint
ALTER TABLE "gameSessions" DROP CONSTRAINT "sessions_campaign_id_campaigns_id_fk";
--> statement-breakpoint
DROP INDEX "navigation_paths_session_id_idx";--> statement-breakpoint
DROP INDEX "revealed_tiles_campaign_id_x_y_idx";--> statement-breakpoint
DROP INDEX "sessions_campaign_id_idx";--> statement-breakpoint
ALTER TABLE "revealed_tiles" ADD COLUMN "always_revealed" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "map_markers" ADD CONSTRAINT "map_markers_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "navigation_paths" ADD CONSTRAINT "navigation_paths_gameSession_id_gameSessions_id_fk" FOREIGN KEY ("gameSession_id") REFERENCES "public"."gameSessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gameSessions" ADD CONSTRAINT "gameSessions_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE cascade ON UPDATE no action;