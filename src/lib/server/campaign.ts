import { db } from './db';
import {
	campaigns,
	pointsOfInterest,
	revealedTiles,
	sessions,
	tileNotes
} from '$lib/server/db/schema';
import { and, desc, eq } from 'drizzle-orm';
import type {
	Campaign,
	CampaignDataResponse,
	CampaignStatsResponse,
	PlayerCampaignDataResponse
} from '$lib/types';
import { hasMapImage } from './imgproxy';

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

	const mapImageExists = await hasMapImage(campaign.slug);

	// Get revealed tiles
	const revealed = await db
		.select({
			x: revealedTiles.x,
			y: revealedTiles.y,
			revealedAt: revealedTiles.revealedAt
		})
		.from(revealedTiles)
		.where(eq(revealedTiles.campaignId, campaignId))
		.orderBy(revealedTiles.revealedAt);

	// Get POIs - separate queries for DM vs Player
	let pois;
	if (isPlayerView) {
		// Player view: only visible POIs
		pois = await db
			.select({
				id: pointsOfInterest.id,
				x: pointsOfInterest.x,
				y: pointsOfInterest.y,
				title: pointsOfInterest.title,
				description: pointsOfInterest.description,
				visibleToPlayers: pointsOfInterest.visibleToPlayers,
				imagePath: pointsOfInterest.imagePath,
				createdAt: pointsOfInterest.createdAt
			})
			.from(pointsOfInterest)
			.where(
				and(
					eq(pointsOfInterest.campaignId, campaignId),
					eq(pointsOfInterest.visibleToPlayers, true)
				)
			)
			.orderBy(pointsOfInterest.createdAt);
	} else {
		// DM view: all POIs
		pois = await db
			.select({
				id: pointsOfInterest.id,
				x: pointsOfInterest.x,
				y: pointsOfInterest.y,
				title: pointsOfInterest.title,
				description: pointsOfInterest.description,
				visibleToPlayers: pointsOfInterest.visibleToPlayers,
				imagePath: pointsOfInterest.imagePath,
				createdAt: pointsOfInterest.createdAt
			})
			.from(pointsOfInterest)
			.where(eq(pointsOfInterest.campaignId, campaignId))
			.orderBy(pointsOfInterest.createdAt);
	}

	// Get tile notes
	const notes = await db
		.select({
			id: tileNotes.id,
			x: tileNotes.x,
			y: tileNotes.y,
			content: tileNotes.content,
			imagePath: tileNotes.imagePath,
			createdAt: tileNotes.createdAt
		})
		.from(tileNotes)
		.where(eq(tileNotes.campaignId, campaignId))
		.orderBy(tileNotes.createdAt);

	// Get recent game sessions (DM only)
	let gameSessions: {
		id: number;
		name: string;
		startTime: Date;
		endTime: Date | null;
		createdAt: Date;
	}[] = [];
	if (!isPlayerView) {
		gameSessions = await db
			.select({
				id: sessions.id,
				name: sessions.name,
				startTime: sessions.startTime,
				endTime: sessions.endTime,
				createdAt: sessions.createdAt
			})
			.from(sessions)
			.where(eq(sessions.campaignId, campaignId))
			.orderBy(desc(sessions.startTime))
			.limit(10);
	}

	return {
		campaign: {
			id: campaign.id,
			name: campaign.name,
			slug: campaign.slug,
			createdAt: campaign.createdAt
		},
		revealedTiles: revealed,
		pointsOfInterest: pois,
		tileNotes: notes,
		gameSessions: gameSessions,
		hasMapImage: mapImageExists
	};
}

export async function getCampaignStats(campaignId: number): Promise<CampaignStatsResponse> {
	const [stats] = await db
		.select({
			revealedCount: db.$count(revealedTiles.id),
			poisCount: db.$count(pointsOfInterest.id),
			notesCount: db.$count(tileNotes.id)
		})
		.from(campaigns)
		.leftJoin(revealedTiles, eq(revealedTiles.campaignId, campaigns.id))
		.leftJoin(pointsOfInterest, eq(pointsOfInterest.campaignId, campaigns.id))
		.leftJoin(tileNotes, eq(tileNotes.campaignId, campaigns.id))
		.where(eq(campaigns.id, campaignId))
		.groupBy(campaigns.id);

	return stats || { revealedCount: 0, poisCount: 0, notesCount: 0 };
}
