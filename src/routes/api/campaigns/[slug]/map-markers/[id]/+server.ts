import { db } from '$lib/server/db';
import { mapMarkers } from '$lib/server/db/schema';
import eventEmitter from '$lib/server/events';
import { requireAuth } from '$lib/server/session';
import { error, json } from '@sveltejs/kit';
import { and, eq } from 'drizzle-orm';
import type { RequestHandler } from './$types';

export const PUT: RequestHandler = async (event) => {
	const { request, params } = event;
	const session = requireAuth(event);

	if (!session) {
		error(401, 'Unauthorized');
	}
	if (session.campaignSlug !== params.slug) {
		error(403, 'Forbidden');
	}

	const markerId = parseInt(params.id, 10);
	const body = await request.json();
	const { title, content, visibleToPlayers } = body;

	const [marker] = await db
		.select()
		.from(mapMarkers)
		.where(and(eq(mapMarkers.id, markerId), eq(mapMarkers.campaignId, session.campaignId)));

	if (!marker) {
		error(404, 'Marker not found');
	}

	if (session.role === 'player' && marker.authorRole !== 'player') {
		error(403, 'Players can only edit their own notes');
	}

	const [updatedMarker] = await db
		.update(mapMarkers)
		.set({
			title,
			content,
			visibleToPlayers
		})
		.where(eq(mapMarkers.id, markerId))
		.returning();

	// Emit event
	eventEmitter.emit(`campaign-${params.slug}`, {
		event: 'marker-updated',
		data: updatedMarker,
		role: updatedMarker.visibleToPlayers ? 'all' : 'dm'
	});

	return json(updatedMarker);
};

export const DELETE: RequestHandler = async (event) => {
	const { params } = event;
	const session = requireAuth(event);

	if (!session) {
		error(401, 'Unauthorized');
	}
	if (session.campaignSlug !== params.slug) {
		error(403, 'Forbidden');
	}

	const markerId = parseInt(params.id, 10);

	const [marker] = await db
		.select()
		.from(mapMarkers)
		.where(and(eq(mapMarkers.id, markerId), eq(mapMarkers.campaignId, session.campaignId)));

	if (!marker) {
		error(404, 'Marker not found');
	}

	if (session.role === 'player' && marker.authorRole !== 'player') {
		error(403, 'Players can only delete their own notes');
	}

	await db.delete(mapMarkers).where(eq(mapMarkers.id, markerId));

	// Emit event
	eventEmitter.emit(`campaign-${params.slug}`, {
		event: 'marker-deleted',
		data: { id: markerId },
		role: marker.visibleToPlayers ? 'all' : 'dm'
	});

	return new Response(null, { status: 204 });
};
