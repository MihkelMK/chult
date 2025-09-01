CREATE INDEX "navigation_paths_session_id_idx" ON "navigation_paths" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "points_of_interest_campaign_id_x_y_idx" ON "points_of_interest" USING btree ("campaign_id","x","y");--> statement-breakpoint
CREATE INDEX "revealed_tiles_campaign_id_x_y_idx" ON "revealed_tiles" USING btree ("campaign_id","x","y");--> statement-breakpoint
CREATE INDEX "tile_notes_campaign_id_x_y_idx" ON "tile_notes" USING btree ("campaign_id","x","y");