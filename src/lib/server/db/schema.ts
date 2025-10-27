import { relations } from 'drizzle-orm';
import {
	boolean,
	doublePrecision,
	index,
	integer,
	jsonb,
	pgTable,
	serial,
	text,
	timestamp
} from 'drizzle-orm/pg-core';

// Campaigns table - main campaign data
export const campaigns = pgTable(
	'campaigns',
	{
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
		imageWidth: integer('image_width').notNull().default(0),
		imageHeight: integer('image_height').notNull().default(0),
		// Exploration state (NEW)
		globalGameTime: doublePrecision('global_game_time').notNull().default(0), // Days as float
		partyTokenX: integer('party_token_x'), // null until first session
		partyTokenY: integer('party_token_y'), // null until first session
		createdAt: timestamp('created_at', { withTimezone: false }).notNull().defaultNow(),
		updatedAt: timestamp('updated_at', { withTimezone: false }).notNull().defaultNow()
	},
	(table) => [
		index('campaigns_slug_idx').on(table.slug),
		index('campaigns_dm_token_idx').on(table.dmToken),
		index('campaigns_player_token_idx').on(table.playerToken)
	]
);

// Revealed tiles - tracks which tiles are revealed to players
export const revealedTiles = pgTable(
	'revealed_tiles',
	{
		id: serial('id').primaryKey(),
		campaignId: integer('campaign_id')
			.notNull()
			.references(() => campaigns.id, { onDelete: 'cascade' }),
		x: integer('x').notNull(),
		y: integer('y').notNull(),
		alwaysRevealed: boolean('always_revealed').notNull().default(false),
		revealedAt: timestamp('revealed_at', { withTimezone: false }).notNull().defaultNow()
	},
	(table) => [index('revealed_tiles_campaign_id_idx').on(table.campaignId)]
);

// GameSessions - DM-created exploration sessions for tracking player movement
export const gameSessions = pgTable(
	'gameSessions',
	{
		id: serial('id').primaryKey(),
		campaignId: integer('campaign_id')
			.notNull()
			.references(() => campaigns.id, { onDelete: 'cascade' }),
		sessionNumber: integer('session_number').notNull(),
		name: text('name').notNull(), // "Session X - yyyy-mm-dd"
		startGameTime: doublePrecision('start_game_time').notNull(), // Game days at start
		endGameTime: doublePrecision('end_game_time'), // Game days at end (null if active)
		startedAt: timestamp('started_at', { withTimezone: false }).notNull().defaultNow(),
		endedAt: timestamp('ended_at', { withTimezone: false }), // null if active
		duration: integer('duration'), // IRL minutes (calculated from startedAt/endedAt)
		isActive: boolean('is_active').notNull().default(false),
		lastActivityAt: timestamp('last_activity_at', { withTimezone: false }).notNull().defaultNow(),
		createdAt: timestamp('created_at', { withTimezone: false }).notNull().defaultNow()
	},
	(table) => [
		index('game_sessions_campaign_id_idx').on(table.campaignId),
		index('game_sessions_campaign_id_is_active_idx').on(table.campaignId, table.isActive),
		index('game_sessions_campaign_id_session_number_idx').on(table.campaignId, table.sessionNumber)
	]
);

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
export const mapMarkers = pgTable(
	'map_markers',
	{
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
	},
	(table) => [index('map_markers_campaign_id_idx').on(table.campaignId)]
);

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

// PathStep union types for type safety
export type PlayerMove = {
	type: 'player_move';
	tileKey: string;
	timestamp: Date;
	gameTime: number;
};

export type DMTeleport = {
	type: 'dm_teleport';
	fromTile: string;
	toTile: string;
	timestamp: Date;
	gameTime: number;
	timeCost: number;
};

export type DMPath = {
	type: 'dm_path';
	tiles: string[];
	timestamp: Date;
	gameTime: number;
	timeCost: number;
};

export type PathStep = PlayerMove | DMTeleport | DMPath;

// Paths - movement history for game sessions (NEW)
export const paths = pgTable(
	'paths',
	{
		id: serial('id').primaryKey(),
		gameSessionId: integer('game_session_id')
			.notNull()
			.references(() => gameSessions.id, { onDelete: 'cascade' }),
		steps: jsonb('steps').notNull().$type<PathStep[]>().default([]),
		revealedTiles: text('revealed_tiles').array().notNull().default([]) // Array of tile keys "col-row"
	},
	(table) => [index('paths_game_session_id_idx').on(table.gameSessionId)]
);

// Time Audit Log - track all time changes (NEW)
export const timeAuditLog = pgTable(
	'time_audit_log',
	{
		id: serial('id').primaryKey(),
		campaignId: integer('campaign_id')
			.notNull()
			.references(() => campaigns.id, { onDelete: 'cascade' }),
		timestamp: timestamp('timestamp', { withTimezone: false }).notNull().defaultNow(),
		type: text('type', {
			enum: ['movement', 'dm_adjust', 'dm_teleport', 'dm_path', 'undo']
		}).notNull(),
		amount: doublePrecision('amount').notNull(), // Time delta in days (can be negative)
		actorRole: text('actor_role', { enum: ['dm', 'player', 'system'] }).notNull(),
		notes: text('notes')
	},
	(table) => [
		index('time_audit_log_campaign_id_idx').on(table.campaignId),
		index('time_audit_log_campaign_id_timestamp_idx').on(table.campaignId, table.timestamp)
	]
);

// Relations for easier querying
export const campaignsRelations = relations(campaigns, ({ many }) => ({
	revealedTiles: many(revealedTiles),
	gameSessions: many(gameSessions),
	mapMarkers: many(mapMarkers),
	uploadedImages: many(uploadedImages),
	// NEW exploration relations
	timeAuditLog: many(timeAuditLog)
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
	navigationPaths: many(navigationPaths),
	paths: many(paths)
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

// NEW: Exploration relations
export const pathsRelations = relations(paths, ({ one }) => ({
	gameSession: one(gameSessions, {
		fields: [paths.gameSessionId],
		references: [gameSessions.id]
	})
}));

export const timeAuditLogRelations = relations(timeAuditLog, ({ one }) => ({
	campaign: one(campaigns, {
		fields: [timeAuditLog.campaignId],
		references: [campaigns.id]
	})
}));
