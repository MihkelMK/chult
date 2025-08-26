import type { RequestHandler } from './$types';
import { json, error } from '@sveltejs/kit';
import { requireAuth } from '$lib/server/session';
import { db } from '$lib/server/db';
import { pointsOfInterest } from '$lib/server/db/schema';

export const POST: RequestHandler = async (event) => {
	const session = requireAuth(event, 'dm');

	if (!session) {
		return error(401, 'Unauthorized');
	}

	if (session.campaignSlug !== event.params.slug) {
		return error(403, 'Access denied');
	}

	try {
		const { x, y, title, description, visibleToPlayers } = await event.request.json();

		if (typeof x !== 'number' || typeof y !== 'number' || !title?.trim()) {
			return error(400, 'Invalid POI data');
		}

		const [poi] = await db
			.insert(pointsOfInterest)
			.values({
				campaignId: session.campaignId,
				x,
				y,
				title: title.trim(),
				description: description?.trim() || null,
				visibleToPlayers: Boolean(visibleToPlayers)
			})
			.returning();

		return json(poi);
	} catch (err) {
		console.error('Create POI error:', err);
		return error(500, 'Failed to create POI');
	}
};
