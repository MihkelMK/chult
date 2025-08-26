import type { RequestHandler } from './$types';
import { json, error } from '@sveltejs/kit';
import { requireAuth } from '$lib/server/session';
import { db } from '$lib/server/db';
import { eq, and } from 'drizzle-orm';
import { revealedTiles } from '$lib/server/db/schema';

export const POST: RequestHandler = async (event) => {
	const session = requireAuth(event, 'dm');

	if (!session) {
		return error(401, 'Unauthorized');
	}

	if (session.campaignSlug !== event.params.slug) {
		return error(403, 'Access denied');
	}

	const { type, tiles } = await event.request.json();

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
							y: tile.y
						}))
					);
				}

				return { revealed: newTiles.length, existing: tiles.length - newTiles.length };
			} else if (type === 'hide') {
				// Batch delete revealed tiles

				// Build OR condition for multiple tiles
				const conditions = tiles.map((tile) =>
					and(eq(revealedTiles.x, tile.x), eq(revealedTiles.y, tile.y))
				);

				let deletedCount = 0;

				// Delete in batches to avoid too complex queries
				const BATCH_SIZE = 50;
				for (let i = 0; i < conditions.length; i += BATCH_SIZE) {
					const batch = conditions.slice(i, i + BATCH_SIZE);

					for (const condition of batch) {
						const deletedRows = await tx
							.delete(revealedTiles)
							.where(and(eq(revealedTiles.campaignId, session.campaignId), condition))
							.returning({ id: revealedTiles.id });

						deletedCount += deletedRows.length;
					}
				}

				return { hidden: deletedCount };
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
