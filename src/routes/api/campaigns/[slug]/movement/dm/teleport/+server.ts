import { db } from '$lib/server/db';
import { campaigns, gameSessions, paths, revealedTiles, timeAuditLog } from '$lib/server/db/schema';
import { emitEvent } from '$lib/server/events';
import type { PathStep } from '$lib/types';
import { error, json } from '@sveltejs/kit';
import { and, eq } from 'drizzle-orm';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ locals, params, request }) => {
	// Only DM can teleport
	if (!locals.session || locals.session.role !== 'dm') {
		throw error(403, 'Only DM can teleport party');
	}

	if (locals.session.campaignSlug !== params.slug) {
		throw error(403, 'Access denied');
	}

	try {
		const { from, to, timeCost } = await request.json();

		// Validate input
		if (
			!from ||
			!to ||
			typeof from.x !== 'number' ||
			typeof from.y !== 'number' ||
			typeof to.x !== 'number' ||
			typeof to.y !== 'number'
		) {
			throw error(400, 'Invalid from/to coordinates');
		}

		if (typeof timeCost !== 'number' || timeCost < 0) {
			throw error(400, 'Invalid timeCost');
		}

		// Get campaign
		const [campaign] = await db
			.select()
			.from(campaigns)
			.where(eq(campaigns.slug, params.slug))
			.limit(1);

		if (!campaign) {
			throw error(404, 'Campaign not found');
		}

		// Get active session
		const [activeSession] = await db
			.select()
			.from(gameSessions)
			.where(and(eq(gameSessions.campaignId, campaign.id), eq(gameSessions.isActive, true)))
			.limit(1);

		if (!activeSession) {
			throw error(400, 'No active session');
		}

		// Validate that from position matches current party position
		if (campaign.partyTokenX !== from.x || campaign.partyTokenY !== from.y) {
			throw error(400, 'From position does not match current party position');
		}

		// Get current path
		const [currentPath] = await db
			.select()
			.from(paths)
			.where(eq(paths.gameSessionId, activeSession.id))
			.limit(1);

		if (!currentPath) {
			throw error(500, 'Path not found for session');
		}

		// Calculate new game time
		const newGameTime = campaign.globalGameTime + timeCost;

		// Create step
		const fromTile = `${from.x}-${from.y}`;
		const toTile = `${to.x}-${to.y}`;

		const step: PathStep = {
			type: 'dm_teleport',
			fromTile,
			toTile,
			timestamp: new Date(),
			gameTime: newGameTime,
			timeCost
		};

		// Add step to path
		const updatedSteps = [...(currentPath.steps as PathStep[]), step];

		// Check if destination tile needs to be revealed
		const [existingTile] = await db
			.select()
			.from(revealedTiles)
			.where(
				and(
					eq(revealedTiles.campaignId, campaign.id),
					eq(revealedTiles.x, to.x),
					eq(revealedTiles.y, to.y)
				)
			)
			.limit(1);

		const tilesToReveal: string[] = [];
		if (!existingTile) {
			// Reveal the destination tile
			await db.insert(revealedTiles).values({
				campaignId: campaign.id,
				x: to.x,
				y: to.y,
				alwaysRevealed: false
			});
			tilesToReveal.push(toTile);

			// Emit tile:revealed event
			emitEvent(params.slug, 'tile:revealed', [{ x: to.x, y: to.y, alwaysRevealed: false }]);
		}

		// Update path with new step and revealed tiles
		const updatedRevealedTiles = currentPath.revealedTiles.includes(toTile)
			? currentPath.revealedTiles
			: [...currentPath.revealedTiles, toTile];

		await db
			.update(paths)
			.set({
				steps: updatedSteps,
				revealedTiles: updatedRevealedTiles
			})
			.where(eq(paths.id, currentPath.id));

		// Update campaign global game time and party position
		await db
			.update(campaigns)
			.set({
				globalGameTime: newGameTime,
				partyTokenX: to.x,
				partyTokenY: to.y
			})
			.where(eq(campaigns.id, campaign.id));

		// Create audit log entry
		await db.insert(timeAuditLog).values({
			campaignId: campaign.id,
			type: 'dm_teleport',
			amount: timeCost,
			actorRole: 'dm',
			notes: `DM teleport from ${fromTile} to ${toTile}`
		});

		// Update session last activity
		await db
			.update(gameSessions)
			.set({ lastActivityAt: new Date() })
			.where(eq(gameSessions.id, activeSession.id));

		// Emit SSE events
		emitEvent(params.slug, 'movement:step-added', {
			sessionId: activeSession.id,
			step,
			tiles: tilesToReveal
		});

		emitEvent(params.slug, 'time:updated', {
			globalGameTime: newGameTime
		});

		return json({ success: true, step, gameTime: newGameTime });
	} catch (err) {
		console.error('Failed to add DM teleport:', err);
		if (err instanceof Error && 'status' in err) {
			throw err;
		}
		throw error(500, 'Failed to add DM teleport');
	}
};
