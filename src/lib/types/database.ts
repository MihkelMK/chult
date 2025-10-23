import type { InferSelectModel, InferInsertModel } from 'drizzle-orm';
import {
	campaigns,
	revealedTiles,
	mapMarkers,
	navigationPaths,
	uploadedImages,
	gameSessions
} from '$lib/server/db/schema';
import type { MapUrlsResponse } from './imgproxy';

// Full model types
export type Campaign = InferSelectModel<typeof campaigns>;
export type RevealedTile = InferSelectModel<typeof revealedTiles>;
export type MapMarker = InferSelectModel<typeof mapMarkers>;
export type GameSession = InferSelectModel<typeof gameSessions>;
export type NavigationPath = InferSelectModel<typeof navigationPaths>;
export type UploadedImage = InferSelectModel<typeof uploadedImages>;

// Insert types
export type NewCampaign = InferInsertModel<typeof campaigns>;
export type NewRevealedTile = InferInsertModel<typeof revealedTiles>;
export type NewMapMarker = InferInsertModel<typeof mapMarkers>;
export type NewGameSession = InferInsertModel<typeof gameSessions>;
export type NewNavigationPath = InferInsertModel<typeof navigationPaths>;
export type NewUploadedImage = InferInsertModel<typeof uploadedImages>;

// Response types that match your actual queries
export type CampaignSummary = Pick<Campaign, 'id' | 'name' | 'slug' | 'createdAt'>;

export type RevealedTileResponse = Pick<RevealedTile, 'x' | 'y' | 'alwaysRevealed' | 'revealedAt'>;

export type MapMarkerResponse = Pick<
	MapMarker,
	| 'id'
	| 'x'
	| 'y'
	| 'type'
	| 'title'
	| 'content'
	| 'authorRole'
	| 'visibleToPlayers'
	| 'imagePath'
	| 'createdAt'
	| 'updatedAt'
>;

export type GameSessionResponse = Pick<
	GameSession,
	'id' | 'name' | 'startTime' | 'endTime' | 'createdAt'
>;

// Player-filtered marker (omits sensitive fields)
export type PlayerMapMarkerResponse = Omit<MapMarkerResponse, 'visibleToPlayers' | 'authorRole'>;

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
	mapMarkers: MapMarkerResponse[];
	gameSessions: GameSessionResponse[];
};

// Player version
export interface PlayerCampaignDataResponse {
	campaign: Pick<
		Campaign,
		| 'id'
		| 'name'
		| 'slug'
		| 'hexesPerRow'
		| 'hexesPerCol'
		| 'hexOffsetX'
		| 'hexOffsetY'
		| 'imageHeight'
		| 'imageWidth'
	>;
	revealedTiles: Pick<RevealedTile, 'x' | 'y' | 'alwaysRevealed'>[];
	mapMarkers: PlayerMapMarkerResponse[];
	gameSessions: never[]; // Players don't get game sessions
	mapUrls: MapUrlsResponse | undefined;
}

export interface CampaignTokenResponse {
	dmToken: string;
	playerToken: string;
}

export type CampaignStatsResponse = {
	revealedCount: number;
	poisCount: number;
	notesCount: number;
};

// Form data types
export type CreateCampaignData = {
	name: string;
};

export type CreateMapMarkerData = {
	x: number;
	y: number;
	type: 'poi' | 'note';
	title?: string;
	content?: string;
	visibleToPlayers?: boolean;
	imagePath?: string;
};
