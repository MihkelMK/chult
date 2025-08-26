import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { relations } from 'drizzle-orm';

// Campaigns table - main campaign data
export const campaigns = sqliteTable('campaigns', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	name: text('name').notNull(),
	slug: text('slug').notNull().unique(),
	dmToken: text('dm_token').notNull().unique(),
	playerToken: text('player_token').notNull().unique(),
	createdAt: integer('created_at', { mode: 'timestamp' })
		.notNull()
		.$defaultFn(() => new Date()),
	updatedAt: integer('updated_at', { mode: 'timestamp' })
		.notNull()
		.$defaultFn(() => new Date())
});

// Revealed tiles - tracks which tiles are revealed to players
export const revealedTiles = sqliteTable('revealed_tiles', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	campaignId: integer('campaign_id')
		.notNull()
		.references(() => campaigns.id, { onDelete: 'cascade' }),
	x: integer('x').notNull(), // 0-based to match component
	y: integer('y').notNull(), // 0-based to match component
	revealedAt: integer('revealed_at', { mode: 'timestamp' })
		.notNull()
		.$defaultFn(() => new Date())
});

// Sessions - DM-created sessions for tracking player movement
export const sessions = sqliteTable('sessions', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	campaignId: integer('campaign_id')
		.notNull()
		.references(() => campaigns.id, { onDelete: 'cascade' }),
	name: text('name').notNull(),
	startTime: integer('start_time', { mode: 'timestamp' })
		.notNull()
		.$defaultFn(() => new Date()),
	endTime: integer('end_time', { mode: 'timestamp' }),
	createdAt: integer('created_at', { mode: 'timestamp' })
		.notNull()
		.$defaultFn(() => new Date())
});

// Navigation paths - player movement during sessions
export const navigationPaths = sqliteTable('navigation_paths', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	sessionId: integer('session_id')
		.notNull()
		.references(() => sessions.id, { onDelete: 'cascade' }),
	x: integer('x').notNull(),
	y: integer('y').notNull(),
	timestamp: integer('timestamp', { mode: 'timestamp' })
		.notNull()
		.$defaultFn(() => new Date()),
	pathGroup: integer('path_group').notNull().default(1)
});

// Points of Interest - DM-created POIs on tiles
export const pointsOfInterest = sqliteTable('points_of_interest', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	campaignId: integer('campaign_id')
		.notNull()
		.references(() => campaigns.id, { onDelete: 'cascade' }),
	x: integer('x').notNull(),
	y: integer('y').notNull(),
	title: text('title').notNull(),
	description: text('description'),
	visibleToPlayers: integer('visible_to_players', { mode: 'boolean' }).notNull().default(false),
	imagePath: text('image_path'),
	createdAt: integer('created_at', { mode: 'timestamp' })
		.notNull()
		.$defaultFn(() => new Date()),
	updatedAt: integer('updated_at', { mode: 'timestamp' })
		.notNull()
		.$defaultFn(() => new Date())
});

// Tile notes - player-created notes on tiles
export const tileNotes = sqliteTable('tile_notes', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	campaignId: integer('campaign_id')
		.notNull()
		.references(() => campaigns.id, { onDelete: 'cascade' }),
	x: integer('x').notNull(),
	y: integer('y').notNull(),
	content: text('content').notNull(),
	imagePath: text('image_path'),
	createdAt: integer('created_at', { mode: 'timestamp' })
		.notNull()
		.$defaultFn(() => new Date()),
	updatedAt: integer('updated_at', { mode: 'timestamp' })
		.notNull()
		.$defaultFn(() => new Date())
});

// Uploaded images - tracking all uploaded files for management
export const uploadedImages = sqliteTable('uploaded_images', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	campaignId: integer('campaign_id')
		.notNull()
		.references(() => campaigns.id, { onDelete: 'cascade' }),
	filename: text('filename').notNull(),
	originalFilename: text('original_filename').notNull(),
	fileSize: integer('file_size').notNull(),
	mimeType: text('mime_type').notNull(),
	uploadTimestamp: integer('upload_timestamp', { mode: 'timestamp' })
		.notNull()
		.$defaultFn(() => new Date()),
	uploadedBy: text('uploaded_by').notNull(), // 'dm' or 'player'
	associatedTable: text('associated_table').notNull(), // 'poi' or 'note'
	associatedId: integer('associated_id').notNull()
});

// Relations for easier querying
export const campaignsRelations = relations(campaigns, ({ many }) => ({
	revealedTiles: many(revealedTiles),
	sessions: many(sessions),
	pointsOfInterest: many(pointsOfInterest),
	tileNotes: many(tileNotes),
	uploadedImages: many(uploadedImages)
}));

export const revealedTilesRelations = relations(revealedTiles, ({ one }) => ({
	campaign: one(campaigns, {
		fields: [revealedTiles.campaignId],
		references: [campaigns.id]
	})
}));

export const sessionsRelations = relations(sessions, ({ one, many }) => ({
	campaign: one(campaigns, {
		fields: [sessions.campaignId],
		references: [campaigns.id]
	}),
	navigationPaths: many(navigationPaths)
}));

export const navigationPathsRelations = relations(navigationPaths, ({ one }) => ({
	session: one(sessions, {
		fields: [navigationPaths.sessionId],
		references: [sessions.id]
	})
}));

export const pointsOfInterestRelations = relations(pointsOfInterest, ({ one }) => ({
	campaign: one(campaigns, {
		fields: [pointsOfInterest.campaignId],
		references: [campaigns.id]
	})
}));

export const tileNotesRelations = relations(tileNotes, ({ one }) => ({
	campaign: one(campaigns, {
		fields: [tileNotes.campaignId],
		references: [campaigns.id]
	})
}));

export const uploadedImagesRelations = relations(uploadedImages, ({ one }) => ({
	campaign: one(campaigns, {
		fields: [uploadedImages.campaignId],
		references: [campaigns.id]
	})
}));
