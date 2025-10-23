import type { RequestHandler } from './$types';
import { json, error } from '@sveltejs/kit';
import { requireAuth } from '$lib/server/session';
import { db } from '$lib/server/db';
import { revealedTiles } from '$lib/server/db/schema';
import eventEmitter from '$lib/server/events';

export const POST: RequestHandler = async (event) => {
	const session = requireAuth(event, 'player');

	if (!session) {
		return error(401, 'Unauthorized');
	}

	if (session.campaignSlug !== event.params.slug) {
		return error(403, 'Access denied');
	}

	try {
		const { x, y } = await event.request.json();

		if (typeof x !== 'number' || typeof y !== 'number') {
			return error(400, 'Invalid coordinates');
		}

		// Check if tile is already revealed
		// const existing = await db
		// 	.select()
		// 	.from(revealedTiles)
		// 	.where(
		// 		eq(revealedTiles.campaignId, session.campaignId) &&
		// 			eq(revealedTiles.x, x) &&
		// 			eq(revealedTiles.y, y)
		// 	)
		// 	.limit(1);
		//
		// if (existing.length > 0) {
		// 	return error(400, { message: 'Tile already explored' });
		// }

		// Reveal the tile
		const [newTile] = await db
			.insert(revealedTiles)
			.values({
				campaignId: session.campaignId,
				x,
				y
			})
			.returning();

		// Emit event to notify everyone (DM should see player exploration)
		eventEmitter.emit(`campaign-${session.campaignSlug}`, {
			event: 'tile-revealed',
			data: [{ x, y }],
			role: 'all'
		});

		return json({ success: true, coordinates: { x, y } });
	} catch (err) {
		console.error('Navigation error:', err);
		return error(500, 'Navigation failed');
	}
};
