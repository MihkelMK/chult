import type { RequestHandler } from './$types';
import { json, error } from '@sveltejs/kit';
import { requireAuth } from '$lib/server/session';
import { db } from '$lib/server/db';
import { tileNotes } from '$lib/server/db/schema';

export const POST: RequestHandler = async (event) => {
	const session = requireAuth(event, 'player');

	if (!session) {
		return error(401, 'Unauthorized');
	}

	if (session.campaignSlug !== event.params.slug) {
		return error(403, 'Access denied');
	}

	try {
		const { x, y, content } = await event.request.json();

		if (typeof x !== 'number' || typeof y !== 'number' || !content?.trim()) {
			return error(400, 'Invalid note data');
		}

		// Add the note
		const [note] = await db
			.insert(tileNotes)
			.values({
				campaignId: session.campaignId,
				x,
				y,
				content: content.trim()
			})
			.returning();

		return json(note);
	} catch (err) {
		console.error('Add note error:', err);
		return error(500, 'Failed to add note');
	}
};
