CREATE INDEX "campaigns_slug_idx" ON "campaigns" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "campaigns_dm_token_idx" ON "campaigns" USING btree ("dm_token");--> statement-breakpoint
CREATE INDEX "campaigns_player_token_idx" ON "campaigns" USING btree ("player_token");--> statement-breakpoint
CREATE INDEX "game_sessions_campaign_id_idx" ON "gameSessions" USING btree ("campaign_id");--> statement-breakpoint
CREATE INDEX "map_markers_campaign_id_idx" ON "map_markers" USING btree ("campaign_id");--> statement-breakpoint
CREATE INDEX "paths_session_id_idx" ON "paths" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "revealed_tiles_campaign_id_idx" ON "revealed_tiles" USING btree ("campaign_id");--> statement-breakpoint
CREATE INDEX "sessions_campaign_id_idx" ON "sessions" USING btree ("campaign_id");--> statement-breakpoint
CREATE INDEX "sessions_campaign_id_is_active_idx" ON "sessions" USING btree ("campaign_id","is_active");--> statement-breakpoint
CREATE INDEX "sessions_campaign_id_session_number_idx" ON "sessions" USING btree ("campaign_id","session_number");--> statement-breakpoint
CREATE INDEX "time_audit_log_campaign_id_idx" ON "time_audit_log" USING btree ("campaign_id");--> statement-breakpoint
CREATE INDEX "time_audit_log_campaign_id_timestamp_idx" ON "time_audit_log" USING btree ("campaign_id","timestamp");