import {
	campaigns,
	gameSessions as gameSessionsSchema,
	mapMarkers,
	paths,
	revealedTiles,
	timeAuditLog
} from '$lib/server/db/schema';
import type {
	Campaign,
	CampaignDataResponse,
	CampaignStatsResponse,
	CampaignTokenResponse,
	PlayerCampaignDataResponse,
	UserRole
} from '$lib/types';
import { and, desc, eq, sql } from 'drizzle-orm';
import { db } from './db';
import { getMapUrls } from './imgproxy';
import { hasMapImage } from './uploads';

function generateSlug(name: string): string {
	return name
		.toLowerCase()
		.replace(/[^a-z0-9\s-]/g, '') // Remove special characters
		.replace(/\s+/g, '-') // Replace spaces with hyphens
		.replace(/-+/g, '-') // Replace multiple hyphens with single
		.trim();
}

function generateAccessToken(): string {
	// Generate a readable but secure token (8 chars, no confusing characters)
	const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
	let result = '';
	for (let i = 0; i < 8; i++) {
		result += chars.charAt(Math.floor(Math.random() * chars.length));
	}
	return result;
}

async function ensureUniqueSlug(baseSlug: string): Promise<string> {
	let slug = baseSlug;
	let counter = 1;

	while (true) {
		const existing = await db
			.select({ id: campaigns.id })
			.from(campaigns)
			.where(eq(campaigns.slug, slug))
			.limit(1);

		if (existing.length === 0) {
			return slug;
		}

		slug = `${baseSlug}-${counter}`;
		counter++;
	}
}

async function ensureUniqueTokens(): Promise<{ dmToken: string; playerToken: string }> {
	let dmToken: string;
	let playerToken: string;

	while (true) {
		dmToken = generateAccessToken();
		playerToken = generateAccessToken();

		// Make sure tokens are different from each other
		if (dmToken === playerToken) continue;

		// Make sure tokens don't already exist
		const existingTokens = await db
			.select({ dmToken: campaigns.dmToken, playerToken: campaigns.playerToken })
			.from(campaigns)
			.where(eq(campaigns.dmToken, dmToken))
			.union(
				db
					.select({ dmToken: campaigns.dmToken, playerToken: campaigns.playerToken })
					.from(campaigns)
					.where(eq(campaigns.playerToken, playerToken))
			)
			.limit(1);

		if (existingTokens.length === 0) {
			return { dmToken, playerToken };
		}
	}
}

export async function createCampaign(name: string): Promise<Campaign> {
	// Validate name
	const trimmedName = name.trim();
	if (!trimmedName || trimmedName.length < 1) {
		throw new Error('Campaign name is required');
	}

	if (trimmedName.length > 100) {
		throw new Error('Campaign name must be less than 100 characters');
	}

	// Generate unique identifiers
	const baseSlug = generateSlug(trimmedName);
	if (!baseSlug) {
		throw new Error('Campaign name must contain at least one letter or number');
	}

	const [slug, tokens] = await Promise.all([ensureUniqueSlug(baseSlug), ensureUniqueTokens()]);

	// Create campaign
	const [campaign] = await db
		.insert(campaigns)
		.values({
			name: trimmedName,
			slug,
			dmToken: tokens.dmToken,
			playerToken: tokens.playerToken
		})
		.returning();

	return campaign;
}

export async function getCampaignById(campaignId: number): Promise<Campaign | null> {
	const [campaign] = await db.select().from(campaigns).where(eq(campaigns.id, campaignId)).limit(1);

	return campaign || null;
}

export async function getCampaignData(
	campaignId: number,
	isPlayerView = false
): Promise<
	((CampaignDataResponse | PlayerCampaignDataResponse) & { hasMapImage?: boolean }) | null
> {
	// Get base campaign info
	const campaign = await getCampaignById(campaignId);
	if (!campaign) return null;

	// Get appropriate map based on role and hasPlayerMap setting
	const mapType: UserRole = isPlayerView && campaign.hasPlayerMap ? 'player' : 'dm';
	const mapUrlsPromise = getMapUrls(campaign.slug, mapType);

	// For DM view, also check if player map file exists
	const hasPlayerMapFilePromise = isPlayerView
		? Promise.resolve(false)
		: hasMapImage(campaign.slug, 'player');

	// Get revealed tiles
	const revealedPromise = db
		.select({
			x: revealedTiles.x,
			y: revealedTiles.y,
			alwaysRevealed: revealedTiles.alwaysRevealed,
			revealedAt: revealedTiles.revealedAt
		})
		.from(revealedTiles)
		.where(eq(revealedTiles.campaignId, campaignId))
		.orderBy(revealedTiles.revealedAt);

	// Get map markers
	const markersPromise = isPlayerView
		? db
				.select()
				.from(mapMarkers)
				.where(and(eq(mapMarkers.campaignId, campaignId), eq(mapMarkers.visibleToPlayers, true)))
				.orderBy(mapMarkers.createdAt)
		: db
				.select()
				.from(mapMarkers)
				.where(eq(mapMarkers.campaignId, campaignId))
				.orderBy(mapMarkers.createdAt);

	// Get exploration game sessions - limit to 50 most recent
	const gameSessionsPromise = db
		.select({
			id: gameSessionsSchema.id,
			sessionNumber: gameSessionsSchema.sessionNumber,
			name: gameSessionsSchema.name,
			startGameTime: gameSessionsSchema.startGameTime,
			endGameTime: gameSessionsSchema.endGameTime,
			startedAt: gameSessionsSchema.startedAt,
			endedAt: gameSessionsSchema.endedAt,
			duration: gameSessionsSchema.duration,
			isActive: gameSessionsSchema.isActive,
			lastActivityAt: gameSessionsSchema.lastActivityAt,
			createdAt: gameSessionsSchema.createdAt
		})
		.from(gameSessionsSchema)
		.where(eq(gameSessionsSchema.campaignId, campaignId))
		.orderBy(desc(gameSessionsSchema.sessionNumber))
		.limit(50);

	// Get paths for game sessions (NEW)
	const pathsPromise = db
		.select({
			id: paths.id,
			gameSessionId: paths.gameSessionId,
			steps: paths.steps,
			revealedTiles: paths.revealedTiles
		})
		.from(paths)
		.innerJoin(gameSessionsSchema, eq(paths.gameSessionId, gameSessionsSchema.id))
		.where(eq(gameSessionsSchema.campaignId, campaignId));

	// Get time audit log (DM only, NEW)
	const timeAuditLogPromise = isPlayerView
		? Promise.resolve(undefined)
		: db
				.select({
					id: timeAuditLog.id,
					timestamp: timeAuditLog.timestamp,
					type: timeAuditLog.type,
					amount: timeAuditLog.amount,
					actorRole: timeAuditLog.actorRole,
					notes: timeAuditLog.notes
				})
				.from(timeAuditLog)
				.where(eq(timeAuditLog.campaignId, campaignId))
				.orderBy(desc(timeAuditLog.timestamp))
				.limit(100);

	const [mapUrls, hasPlayerMapFile, revealed, markers, gameSessions, explorationPaths, auditLog] =
		await Promise.all([
			mapUrlsPromise,
			hasPlayerMapFilePromise,
			revealedPromise,
			markersPromise,
			gameSessionsPromise,
			pathsPromise,
			timeAuditLogPromise
		]);

	return {
		campaign: {
			id: campaign.id,
			name: campaign.name,
			slug: campaign.slug,
			createdAt: campaign.createdAt,
			hasPlayerMap: campaign.hasPlayerMap,
			hexOffsetX: campaign.hexOffsetX,
			hexOffsetY: campaign.hexOffsetY,
			hexesPerCol: campaign.hexesPerCol,
			hexesPerRow: campaign.hexesPerRow,
			imageHeight: campaign.imageHeight,
			imageWidth: campaign.imageWidth,
			globalGameTime: campaign.globalGameTime,
			partyTokenX: campaign.partyTokenX,
			partyTokenY: campaign.partyTokenY
		},
		revealedTiles: revealed,
		mapMarkers: markers,
		gameSessions: gameSessions,
		paths: explorationPaths,
		timeAuditLog: auditLog,
		mapUrls: mapUrls,
		hasPlayerMapFile: hasPlayerMapFile
	};
}

export async function getCampaignTokens(campaignId: number): Promise<CampaignTokenResponse | null> {
	// Get base campaign info
	const campaign = await getCampaignById(campaignId);
	if (!campaign) return null;

	return {
		dmToken: campaign.dmToken,
		playerToken: campaign.playerToken
	};
}

export async function getCampaignStats(campaignId: number): Promise<CampaignStatsResponse> {
	const [stats] = await db
		.select({
			revealedCount: sql<number>`count(distinct ${revealedTiles.id})`.mapWith(Number),
			poisCount: sql<number>`count(case when ${mapMarkers.type} = 'poi' then 1 end)`.mapWith(
				Number
			),
			notesCount: sql<number>`count(case when ${mapMarkers.type} = 'note' then 1 end)`.mapWith(
				Number
			)
		})
		.from(campaigns)
		.leftJoin(revealedTiles, eq(revealedTiles.campaignId, campaigns.id))
		.leftJoin(mapMarkers, eq(mapMarkers.campaignId, campaigns.id))
		.where(eq(campaigns.id, campaignId))
		.groupBy(campaigns.id);

	return stats || { revealedCount: 0, poisCount: 0, notesCount: 0 };
}
