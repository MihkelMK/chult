ALTER TABLE "sessions" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "sessions" CASCADE;--> statement-breakpoint
ALTER TABLE "gameSessions" RENAME COLUMN "start_time" TO "started_at";--> statement-breakpoint
ALTER TABLE "gameSessions" RENAME COLUMN "end_time" TO "ended_at";--> statement-breakpoint
ALTER TABLE "paths" DROP CONSTRAINT "paths_session_id_sessions_id_fk";
--> statement-breakpoint
DROP INDEX "paths_session_id_idx";--> statement-breakpoint
ALTER TABLE "gameSessions" ADD COLUMN "session_number" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "gameSessions" ADD COLUMN "start_game_time" double precision NOT NULL;--> statement-breakpoint
ALTER TABLE "gameSessions" ADD COLUMN "end_game_time" double precision;--> statement-breakpoint
ALTER TABLE "gameSessions" ADD COLUMN "duration" integer;--> statement-breakpoint
ALTER TABLE "gameSessions" ADD COLUMN "is_active" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "gameSessions" ADD COLUMN "last_activity_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "paths" ADD COLUMN "game_session_id" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "paths" ADD CONSTRAINT "paths_game_session_id_gameSessions_id_fk" FOREIGN KEY ("game_session_id") REFERENCES "public"."gameSessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "game_sessions_campaign_id_is_active_idx" ON "gameSessions" USING btree ("campaign_id","is_active");--> statement-breakpoint
CREATE INDEX "game_sessions_campaign_id_session_number_idx" ON "gameSessions" USING btree ("campaign_id","session_number");--> statement-breakpoint
CREATE INDEX "paths_game_session_id_idx" ON "paths" USING btree ("game_session_id");--> statement-breakpoint
ALTER TABLE "paths" DROP COLUMN "session_id";