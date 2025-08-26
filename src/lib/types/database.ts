import type { InferSelectModel, InferInsertModel } from 'drizzle-orm';
import {
	campaigns,
	revealedTiles,
	pointsOfInterest,
	tileNotes,
	sessions,
	navigationPaths,
	uploadedImages
} from '$lib/server/db/schema';

// Full model types
export type Campaign = InferSelectModel<typeof campaigns>;
export type RevealedTile = InferSelectModel<typeof revealedTiles>;
export type PointOfInterest = InferSelectModel<typeof pointsOfInterest>;
export type TileNote = InferSelectModel<typeof tileNotes>;
export type GameSession = InferSelectModel<typeof sessions>;
export type NavigationPath = InferSelectModel<typeof navigationPaths>;
export type UploadedImage = InferSelectModel<typeof uploadedImages>;

// Insert types
export type NewCampaign = InferInsertModel<typeof campaigns>;
export type NewRevealedTile = InferInsertModel<typeof revealedTiles>;
export type NewPointOfInterest = InferInsertModel<typeof pointsOfInterest>;
export type NewTileNote = InferInsertModel<typeof tileNotes>;
export type NewGameSession = InferInsertModel<typeof sessions>;
export type NewNavigationPath = InferInsertModel<typeof navigationPaths>;
export type NewUploadedImage = InferInsertModel<typeof uploadedImages>;

// Response types that match your actual queries
export type CampaignSummary = Pick<Campaign, 'id' | 'name' | 'slug' | 'createdAt'>;

export type RevealedTileResponse = Pick<RevealedTile, 'x' | 'y' | 'revealedAt'>;

export type PointOfInterestResponse = Pick<
	PointOfInterest,
	'id' | 'x' | 'y' | 'title' | 'description' | 'visibleToPlayers' | 'imagePath' | 'createdAt'
>;

export type TileNoteResponse = Pick<
	TileNote,
	'id' | 'x' | 'y' | 'content' | 'imagePath' | 'createdAt'
>;

export type GameSessionResponse = Pick<
	GameSession,
	'id' | 'name' | 'startTime' | 'endTime' | 'createdAt'
>;

// Player-filtered POI (excludes visibleToPlayers field)
export type PlayerPointOfInterest = Omit<PointOfInterestResponse, 'visibleToPlayers'>;

// Session data type
export type SessionData = {
	campaignId: number;
	campaignSlug: string;
	role: 'dm' | 'player';
	expiresAt: number;
};

// API response types
export type CampaignDataResponse = {
	campaign: CampaignSummary;
	revealedTiles: RevealedTileResponse[];
	pointsOfInterest: PointOfInterestResponse[];
	tileNotes: TileNoteResponse[];
	gameSessions: GameSessionResponse[];
};

// Player version (POIs without visibleToPlayers field)
export type PlayerCampaignDataResponse = {
	campaign: CampaignSummary;
	revealedTiles: RevealedTileResponse[];
	pointsOfInterest: PlayerPointOfInterest[];
	tileNotes: TileNoteResponse[];
	sessions: never[]; // Players don't get sessions
};

export type CampaignStatsResponse = {
	revealedCount: number;
	poisCount: number;
	notesCount: number;
};

// Form data types
export type CreateCampaignData = {
	name: string;
};

export type CreatePOIData = {
	x: number;
	y: number;
	title: string;
	description?: string;
	visibleToPlayers: boolean;
	imagePath?: string;
};

export type CreateTileNoteData = {
	x: number;
	y: number;
	content: string;
	imagePath?: string;
};
