import {
	campaigns,
	gameSessions,
	mapMarkers,
	navigationPaths,
	paths,
	revealedTiles,
	sessions,
	timeAuditLog,
	uploadedImages
} from '$lib/server/db/schema';
import type { InferInsertModel, InferSelectModel } from 'drizzle-orm';
import type { MapUrlsResponse } from './imgproxy';

// Export PathStep types from schema
export type { PathStep } from '$lib/server/db/schema';

// Full model types
export type Campaign = InferSelectModel<typeof campaigns>;
export type RevealedTile = InferSelectModel<typeof revealedTiles>;
export type MapMarker = InferSelectModel<typeof mapMarkers>;
export type GameSession = InferSelectModel<typeof gameSessions>;
export type NavigationPath = InferSelectModel<typeof navigationPaths>;
export type UploadedImage = InferSelectModel<typeof uploadedImages>;
export type Session = InferSelectModel<typeof sessions>;
export type Path = InferSelectModel<typeof paths>;
export type TimeAuditLog = InferSelectModel<typeof timeAuditLog>;

// Insert types
export type NewCampaign = InferInsertModel<typeof campaigns>;
export type NewRevealedTile = InferInsertModel<typeof revealedTiles>;
export type NewMapMarker = InferInsertModel<typeof mapMarkers>;
export type NewGameSession = InferInsertModel<typeof gameSessions>;
export type NewNavigationPath = InferInsertModel<typeof navigationPaths>;
export type NewUploadedImage = InferInsertModel<typeof uploadedImages>;
export type NewSession = InferInsertModel<typeof sessions>;
export type NewPath = InferInsertModel<typeof paths>;
export type NewTimeAuditLog = InferInsertModel<typeof timeAuditLog>;

// Response types that match your actual queries
export type CampaignSummary = Pick<
	Campaign,
	| 'id'
	| 'name'
	| 'slug'
	| 'createdAt'
	| 'hexesPerRow'
	| 'hexesPerCol'
	| 'hexOffsetX'
	| 'hexOffsetY'
	| 'imageHeight'
	| 'imageWidth'
	| 'globalGameTime'
	| 'partyTokenX'
	| 'partyTokenY'
>;

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

// Exploration session response types
export type SessionResponse = Pick<
	Session,
	| 'id'
	| 'sessionNumber'
	| 'name'
	| 'startGameTime'
	| 'endGameTime'
	| 'startedAt'
	| 'endedAt'
	| 'duration'
	| 'isActive'
	| 'lastActivityAt'
>;

export type PathResponse = Pick<Path, 'id' | 'sessionId' | 'steps' | 'revealedTiles'>;

export type TimeAuditLogResponse = Pick<
	TimeAuditLog,
	'id' | 'timestamp' | 'type' | 'amount' | 'actorRole' | 'notes'
>;

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
	// Exploration data (NEW)
	sessions: SessionResponse[];
	paths: PathResponse[];
	timeAuditLog?: TimeAuditLogResponse[]; // DM only
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
		| 'globalGameTime'
		| 'partyTokenX'
		| 'partyTokenY'
	>;
	revealedTiles: Pick<RevealedTile, 'x' | 'y' | 'alwaysRevealed'>[];
	mapMarkers: MapMarkerResponse[];
	gameSessions: never[]; // Players don't get game sessions
	// Exploration data (NEW)
	sessions: SessionResponse[];
	paths: PathResponse[];
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
