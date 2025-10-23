import { db } from '$lib/server/db';
import { mapMarkers } from '$lib/server/db/schema';
import eventEmitter from '$lib/server/events';
import { requireAuth } from '$lib/server/session';
import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async (event) => {
	const { request, params } = event;
	const session = requireAuth(event);

	if (!session) {
		error(401, 'Unauthorized');
	}
	if (session.campaignSlug !== params.slug) {
		error(403, 'Forbidden');
	}

	const body = await request.json();
	const { x, y, type, title, content, visibleToPlayers } = body;

	if (type === 'poi' && session.role !== 'dm') {
		error(403, 'Only DMs can create POIs');
	}

	const [newMarker] = await db
		.insert(mapMarkers)
		.values({
			campaignId: session.campaignId,
			x,
			y,
			type,
			title,
			content,
			authorRole: session.role,
			visibleToPlayers: type === 'note' ? true : visibleToPlayers
		})
		.returning();

	// Emit event
	eventEmitter.emit(`campaign-${params.slug}`, {
		event: 'marker-created',
		data: newMarker,
		role: newMarker.visibleToPlayers ? 'all' : 'dm'
	});

	return json(newMarker);
};
