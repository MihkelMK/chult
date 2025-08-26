import type { RequestHandler } from './$types';
import { json, error } from '@sveltejs/kit';
import { requireAuth } from '$lib/server/session';
import { db } from '$lib/server/db';
import { eq, and } from 'drizzle-orm';
import { pointsOfInterest } from '$lib/server/db/schema';

export const PUT: RequestHandler = async (event) => {
	const session = requireAuth(event, 'dm');

	if (!session) {
		return error(401, 'Unauthorized');
	}

	if (session.campaignSlug !== event.params.slug) {
		return error(403, 'Access denied');
	}

	try {
		const poiId = parseInt(event.params.id);
		const { title, description, visibleToPlayers } = await event.request.json();

		if (!title?.trim()) {
			return error(400, 'Title is required');
		}

		const [updatedPoi] = await db
			.update(pointsOfInterest)
			.set({
				title: title.trim(),
				description: description?.trim() || null,
				visibleToPlayers: Boolean(visibleToPlayers),
				updatedAt: new Date()
			})
			.where(
				and(eq(pointsOfInterest.id, poiId), eq(pointsOfInterest.campaignId, session.campaignId))
			)
			.returning();

		if (!updatedPoi) {
			return error(404, 'POI not found');
		}

		return json(updatedPoi);
	} catch (err) {
		console.error('Update POI error:', err);
		return error(500, 'Failed to update POI');
	}
};

export const DELETE: RequestHandler = async (event) => {
	const session = requireAuth(event, 'dm');

	if (!session) {
		return error(401, 'Unauthorized');
	}

	if (session.campaignSlug !== event.params.slug) {
		return error(403, 'Access denied');
	}

	try {
		const poiId = parseInt(event.params.id);

		const deleted = await db
			.delete(pointsOfInterest)
			.where(
				and(eq(pointsOfInterest.id, poiId), eq(pointsOfInterest.campaignId, session.campaignId))
			)
			.returning();

		if (deleted.length === 0) {
			return error(404, 'POI not found');
		}

		return json({ success: true });
	} catch (err) {
		console.error('Delete POI error:', err);
		return error(500, 'Failed to delete POI');
	}
};
