ALTER TABLE "campaigns" ADD COLUMN "hexes_per_row" integer DEFAULT 20 NOT NULL;--> statement-breakpoint
ALTER TABLE "campaigns" ADD COLUMN "hexes_per_col" integer DEFAULT 20 NOT NULL;--> statement-breakpoint
ALTER TABLE "campaigns" ADD COLUMN "hex_offset_x" integer DEFAULT 70 NOT NULL;--> statement-breakpoint
ALTER TABLE "campaigns" ADD COLUMN "hex_offset_y" integer DEFAULT 58 NOT NULL;