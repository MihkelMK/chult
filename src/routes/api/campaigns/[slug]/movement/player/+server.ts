import { db } from '$lib/server/db';
import { campaigns, paths, revealedTiles, sessions, timeAuditLog } from '$lib/server/db/schema';
import { emitEvent } from '$lib/server/events';
import type { PathStep } from '$lib/types';
import { error, json } from '@sveltejs/kit';
import { and, eq } from 'drizzle-orm';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ locals, params, request }) => {
	// Both DM and players can make player moves
	if (!locals.session) {
		throw error(403, 'Not authenticated');
	}

	if (locals.session.campaignSlug !== params.slug) {
		throw error(403, 'Access denied');
	}

	try {
		const { tileKey } = await request.json();

		if (!tileKey || typeof tileKey !== 'string') {
			throw error(400, 'Invalid tileKey');
		}

		// Parse tile coordinates
		const [col, row] = tileKey.split('-').map(Number);
		if (isNaN(col) || isNaN(row)) {
			throw error(400, 'Invalid tile coordinates');
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
			.from(sessions)
			.where(and(eq(sessions.campaignId, campaign.id), eq(sessions.isActive, true)))
			.limit(1);

		if (!activeSession) {
			throw error(400, 'No active session');
		}

		// TODO: Validate that tile is adjacent to current party position

		// Get current path
		const [currentPath] = await db
			.select()
			.from(paths)
			.where(eq(paths.sessionId, activeSession.id))
			.limit(1);

		if (!currentPath) {
			throw error(500, 'Path not found for session');
		}

		// Calculate time increment (0.5 days per tile)
		const timeCost = 0.5;
		const newGameTime = campaign.globalGameTime + timeCost;

		// Create step
		const step: PathStep = {
			type: 'player_move',
			tileKey,
			timestamp: new Date(),
			gameTime: newGameTime
		};

		// Add step to path
		const updatedSteps = [...(currentPath.steps as PathStep[]), step];

		// Check if tile needs to be revealed
		const [existingTile] = await db
			.select()
			.from(revealedTiles)
			.where(
				and(
					eq(revealedTiles.campaignId, campaign.id),
					eq(revealedTiles.x, col),
					eq(revealedTiles.y, row)
				)
			)
			.limit(1);

		const tilesToReveal: string[] = [];
		if (!existingTile) {
			// Reveal the tile
			await db.insert(revealedTiles).values({
				campaignId: campaign.id,
				x: col,
				y: row,
				alwaysRevealed: false
			});
			tilesToReveal.push(tileKey);

			// Emit tile-revealed event
			emitEvent(params.slug, 'tile-revealed', [{ x: col, y: row, alwaysRevealed: false }]);
		}

		// Update path with new step and revealed tiles
		const updatedRevealedTiles = currentPath.revealedTiles.includes(tileKey)
			? currentPath.revealedTiles
			: [...currentPath.revealedTiles, tileKey];

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
				partyTokenX: col,
				partyTokenY: row
			})
			.where(eq(campaigns.id, campaign.id));

		// Create audit log entry
		await db.insert(timeAuditLog).values({
			campaignId: campaign.id,
			type: 'movement',
			amount: timeCost,
			actorRole: locals.session.role,
			notes: `Player move to ${tileKey}`
		});

		// Update session last activity
		await db
			.update(sessions)
			.set({ lastActivityAt: new Date() })
			.where(eq(sessions.id, activeSession.id));

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
		console.error('Failed to add player move:', err);
		if (err instanceof Error && 'status' in err) {
			throw err;
		}
		throw error(500, 'Failed to add player move');
	}
};
