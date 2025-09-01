import type { RequestHandler } from './$types';
import { json, error } from '@sveltejs/kit';
import { requireAuth } from '$lib/server/session';
import { db } from '$lib/server/db';
import { eq, and, or } from 'drizzle-orm';
import { revealedTiles } from '$lib/server/db/schema';
import eventEmitter from '$lib/server/events';

export const POST: RequestHandler = async (event) => {
	const session = requireAuth(event, 'dm');

	if (!session) {
		return error(401, 'Unauthorized');
	}

	if (session.campaignSlug !== event.params.slug) {
		return error(403, 'Access denied');
	}

	const { type, tiles, alwaysRevealed = false } = await event.request.json();

	try {
		if (!type || !Array.isArray(tiles) || tiles.length === 0) {
			return error(400, 'Invalid batch operation data');
		}

		// Validate all coordinates
		for (const tile of tiles) {
			if (typeof tile.x !== 'number' || typeof tile.y !== 'number') {
				return error(400, 'Invalid tile coordinates');
			}
		}

		// Use transaction for consistency
		const result = await db.transaction(async (tx) => {
			if (type === 'reveal') {
				// Batch insert revealed tiles
				// First, get existing tiles to avoid duplicates
				const existing = await tx
					.select({ x: revealedTiles.x, y: revealedTiles.y })
					.from(revealedTiles)
					.where(eq(revealedTiles.campaignId, session.campaignId));

				const existingSet = new Set(existing.map((t) => `${t.x},${t.y}`));
				const newTiles = tiles.filter((tile) => !existingSet.has(`${tile.x},${tile.y}`));

				if (newTiles.length > 0) {
					await tx.insert(revealedTiles).values(
						newTiles.map((tile) => ({
							campaignId: session.campaignId,
							x: tile.x,
							y: tile.y,
							alwaysRevealed: alwaysRevealed
						}))
					);
					eventEmitter.emit(`campaign-${session.campaignSlug}`, {
						event: 'tile-revealed',
						data: newTiles,
						role: 'player'
					});
				}

				return { revealed: newTiles.length, existing: tiles.length - newTiles.length };
			} else if (type === 'hide') {
				// Batch delete revealed tiles
				const tileCoordinates = tiles.map((t) => ({ x: t.x, y: t.y }));

				// Create OR conditions for each coordinate pair
				const coordinateConditions = tileCoordinates.map((coords) =>
					and(eq(revealedTiles.x, coords.x), eq(revealedTiles.y, coords.y))
				);

				const deletedTiles = await tx
					.delete(revealedTiles)
					.where(
						and(
							eq(revealedTiles.campaignId, session.campaignId),
							eq(revealedTiles.alwaysRevealed, false), // Only delete non-always-revealed tiles
							or(...coordinateConditions)
						)
					)
					.returning({ x: revealedTiles.x, y: revealedTiles.y });

				if (deletedTiles.length > 0) {
					eventEmitter.emit(`campaign-${session.campaignSlug}`, {
						event: 'tile-hidden',
						data: deletedTiles,
						role: 'player'
					});
				}

				return { hidden: deletedTiles.length };
			} else if (type === 'toggle-always-revealed') {
				// Toggle always-revealed status for existing tiles
				const tileCoordinates = tiles.map((t) => ({ x: t.x, y: t.y }));
				const coordinateConditions = tileCoordinates.map((coords) =>
					and(eq(revealedTiles.x, coords.x), eq(revealedTiles.y, coords.y))
				);

				// First, find existing tiles to determine current status
				const existingTiles = await tx
					.select()
					.from(revealedTiles)
					.where(
						and(eq(revealedTiles.campaignId, session.campaignId), or(...coordinateConditions))
					);

				const updatedTiles = await tx
					.update(revealedTiles)
					.set({ alwaysRevealed: alwaysRevealed })
					.where(and(eq(revealedTiles.campaignId, session.campaignId), or(...coordinateConditions)))
					.returning({
						x: revealedTiles.x,
						y: revealedTiles.y,
						alwaysRevealed: revealedTiles.alwaysRevealed
					});

				// For tiles that don't exist yet, create them as always-revealed
				const existingCoords = new Set(existingTiles.map((t) => `${t.x},${t.y}`));
				const newAlwaysTiles = tiles.filter((tile) => !existingCoords.has(`${tile.x},${tile.y}`));

				if (newAlwaysTiles.length > 0 && alwaysRevealed) {
					await tx.insert(revealedTiles).values(
						newAlwaysTiles.map((tile) => ({
							campaignId: session.campaignId,
							x: tile.x,
							y: tile.y,
							alwaysRevealed: true
						}))
					);
				}

				eventEmitter.emit(`campaign-${session.campaignSlug}`, {
					event: 'tiles-always-revealed-updated',
					data: { updated: updatedTiles, created: newAlwaysTiles },
					role: 'player'
				});

				return { updated: updatedTiles.length, created: newAlwaysTiles.length };
			} else {
				throw new Error('Invalid operation type');
			}
		});

		return json({
			success: true,
			operation: type,
			processed: tiles.length,
			result
		});
	} catch (err) {
		console.error('Batch tile operation error:', err);
		return error(500, `Failed to ${type} tiles`);
	}
};
