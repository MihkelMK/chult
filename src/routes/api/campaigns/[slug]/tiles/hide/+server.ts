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

	try {
		const { x, y } = await event.request.json();

		if (typeof x !== 'number' || typeof y !== 'number') {
			return error(400, 'Invalid coordinates');
		}

		// Remove the revealed tile
		await db
			.delete(revealedTiles)
			.where(
				and(
					eq(revealedTiles.campaignId, session.campaignId),
					eq(revealedTiles.x, x),
					eq(revealedTiles.y, y)
				)
			);

		return json({ success: true });
	} catch (err) {
		console.error('Hide tile error:', err);
		return error(500, 'Failed to hide tile');
	}
};
