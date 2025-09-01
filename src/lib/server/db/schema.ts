import { pgTable, serial, text, integer, timestamp, boolean } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// Campaigns table - main campaign data
export const campaigns = pgTable('campaigns', {
	id: serial('id').primaryKey(),
	name: text('name').notNull(),
	slug: text('slug').notNull().unique(),
	dmToken: text('dm_token').notNull().unique(),
	playerToken: text('player_token').notNull().unique(),
	// Hex grid configuration
	hexesPerRow: integer('hexes_per_row').notNull().default(20),
	hexesPerCol: integer('hexes_per_col').notNull().default(20),
	hexOffsetX: integer('hex_offset_x').notNull().default(70),
	hexOffsetY: integer('hex_offset_y').notNull().default(58),
	createdAt: timestamp('created_at', { withTimezone: false }).notNull().defaultNow(),
	updatedAt: timestamp('updated_at', { withTimezone: false }).notNull().defaultNow()
});

// Revealed tiles - tracks which tiles are revealed to players
export const revealedTiles = pgTable('revealed_tiles', {
	id: serial('id').primaryKey(),
	campaignId: integer('campaign_id')
		.notNull()
		.references(() => campaigns.id, { onDelete: 'cascade' }),
	x: integer('x').notNull(),
	y: integer('y').notNull(),
	alwaysRevealed: boolean('always_revealed').notNull().default(false),
	revealedAt: timestamp('revealed_at', { withTimezone: false }).notNull().defaultNow()
});

// GameSessions - DM-created gameSessions for tracking player movement
export const gameSessions = pgTable('gameSessions', {
	id: serial('id').primaryKey(),
	campaignId: integer('campaign_id')
		.notNull()
		.references(() => campaigns.id, { onDelete: 'cascade' }),
	name: text('name').notNull(),
	startTime: timestamp('start_time', { withTimezone: false }).notNull().defaultNow(),
	endTime: timestamp('end_time', { withTimezone: false }),
	createdAt: timestamp('created_at', { withTimezone: false }).notNull().defaultNow()
});

// Navigation paths - player movement during gameSessions
export const navigationPaths = pgTable('navigation_paths', {
	id: serial('id').primaryKey(),
	gameSessionId: integer('gameSession_id')
		.notNull()
		.references(() => gameSessions.id, { onDelete: 'cascade' }),
	x: integer('x').notNull(),
	y: integer('y').notNull(),
	timestamp: timestamp('timestamp', { withTimezone: false }).notNull().defaultNow(),
	pathGroup: integer('path_group').notNull().default(1)
});

// Points of Interest - DM-created POIs on tiles
export const mapMarkers = pgTable('map_markers', {
	id: serial('id').primaryKey(),
	campaignId: integer('campaign_id')
		.notNull()
		.references(() => campaigns.id, { onDelete: 'cascade' }),
	x: integer('x').notNull(),
	y: integer('y').notNull(),
	type: text('type', { enum: ['poi', 'note'] }).notNull(),
	title: text('title'), // Required for POIs, optional for notes
	content: text('content'), // Description for POIs, body for notes
	imagePath: text('image_path'),
	authorRole: text('author_role', { enum: ['dm', 'player'] }).notNull(),
	visibleToPlayers: boolean('visible_to_players').notNull().default(false),
	createdAt: timestamp('created_at', { withTimezone: false }).notNull().defaultNow(),
	updatedAt: timestamp('updated_at', { withTimezone: false }).notNull().defaultNow()
});

// Uploaded images - tracking all uploaded files for management
export const uploadedImages = pgTable('uploaded_images', {
	id: serial('id').primaryKey(),
	campaignId: integer('campaign_id')
		.notNull()
		.references(() => campaigns.id, { onDelete: 'cascade' }),
	filename: text('filename').notNull(),
	originalFilename: text('original_filename').notNull(),
	fileSize: integer('file_size').notNull(),
	mimeType: text('mime_type').notNull(),
	uploadTimestamp: timestamp('upload_timestamp', { withTimezone: false }).notNull().defaultNow(),
	uploadedBy: text('uploaded_by').notNull(), // 'dm' or 'player'
	associatedTable: text('associated_table').notNull(), // 'poi' or 'note'
	associatedId: integer('associated_id').notNull()
});

// Relations for easier querying
export const campaignsRelations = relations(campaigns, ({ many }) => ({
	revealedTiles: many(revealedTiles),
	gameSessions: many(gameSessions),
	mapMarkers: many(mapMarkers),
	uploadedImages: many(uploadedImages)
}));

export const revealedTilesRelations = relations(revealedTiles, ({ one }) => ({
	campaign: one(campaigns, {
		fields: [revealedTiles.campaignId],
		references: [campaigns.id]
	})
}));

export const gameSessionsRelations = relations(gameSessions, ({ one, many }) => ({
	campaign: one(campaigns, {
		fields: [gameSessions.campaignId],
		references: [campaigns.id]
	}),
	navigationPaths: many(navigationPaths)
}));

export const navigationPathsRelations = relations(navigationPaths, ({ one }) => ({
	gameSession: one(gameSessions, {
		fields: [navigationPaths.gameSessionId],
		references: [gameSessions.id]
	})
}));

export const mapMarkersRelations = relations(mapMarkers, ({ one }) => ({
	campaign: one(campaigns, {
		fields: [mapMarkers.campaignId],
		references: [campaigns.id]
	})
}));

export const uploadedImagesRelations = relations(uploadedImages, ({ one }) => ({
	campaign: one(campaigns, {
		fields: [uploadedImages.campaignId],
		references: [campaigns.id]
	})
}));
