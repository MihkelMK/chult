import { db } from '$lib/server/db';
import { campaigns, mapMarkers } from '$lib/server/db/schema';
import { emitEvent } from '$lib/server/events';
import { type MarkerType } from '$lib/types';
import { MARKER_TYPES } from '$lib/utils/mapMarkers';
import { error, json } from '@sveltejs/kit';
import { and, eq } from 'drizzle-orm';
import type { RequestHandler } from './$types';

// PATCH /api/campaigns/[slug]/markers/[id] - Update marker
export const PATCH: RequestHandler = async ({ params, locals, request }) => {
	if (!locals.session) {
		return error(401, 'Unauthorized');
	}

	const markerId = parseInt(params.id, 10);
	if (isNaN(markerId)) {
		return error(400, 'Invalid marker ID');
	}

	// Get campaign and verify access
	const campaign = await db.query.campaigns.findFirst({
		where: eq(campaigns.slug, params.slug)
	});

	if (!campaign) {
		return error(404, 'Campaign not found');
	}

	const userRole = locals.session.role as 'dm' | 'player' | undefined;
	if (!userRole) {
		return error(403, 'Invalid session');
	}

	// Get existing marker
	const existingMarker = await db.query.mapMarkers.findFirst({
		where: and(eq(mapMarkers.id, markerId), eq(mapMarkers.campaignId, campaign.id))
	});

	if (!existingMarker) {
		return error(404, 'Marker not found');
	}

	// Permission check: Players can only edit their own markers, DM can edit all
	if (userRole === 'player' && existingMarker.authorRole !== 'player') {
		return error(403, 'You can only edit your own markers');
	}

	// Parse request body
	const body = await request.json();
	const { type, title, content, visibleToPlayers, imagePath } = body;

	// Validation
	if (type !== undefined) {
		if (!MARKER_TYPES.includes(type as MarkerType)) {
			return error(400, 'Invalid marker type');
		}
	}

	if (title !== undefined) {
		if (typeof title !== 'string' || title.trim().length === 0) {
			return error(400, 'Title cannot be empty');
		}
	}

	if (content !== undefined && content !== null && typeof content !== 'string') {
		return error(400, 'Invalid content');
	}

	if (visibleToPlayers !== undefined && typeof visibleToPlayers !== 'boolean') {
		return error(400, 'Invalid visibleToPlayers value');
	}

	if (imagePath !== undefined && imagePath !== null && typeof imagePath !== 'string') {
		return error(400, 'Invalid imagePath');
	}

	// Build update object (only include provided fields)
	const updates: Partial<typeof existingMarker> = {
		updatedAt: new Date()
	};

	if (type !== undefined) updates.type = type;
	if (title !== undefined) updates.title = title.trim();
	if (content !== undefined) updates.content = content?.trim() || null;
	if (visibleToPlayers !== undefined) updates.visibleToPlayers = visibleToPlayers;
	if (imagePath !== undefined) updates.imagePath = imagePath || null;

	// Update marker
	const [updatedMarker] = await db
		.update(mapMarkers)
		.set(updates)
		.where(eq(mapMarkers.id, markerId))
		.returning();

	// Emit SSE event
	emitEvent(params.slug, 'marker:updated', updatedMarker);

	return json(updatedMarker);
};

// DELETE /api/campaigns/[slug]/markers/[id] - Delete marker
export const DELETE: RequestHandler = async ({ params, locals }) => {
	if (!locals.session) {
		return error(401, 'Unauthorized');
	}

	const markerId = parseInt(params.id, 10);
	if (isNaN(markerId)) {
		return error(400, 'Invalid marker ID');
	}

	// Get campaign and verify access
	const campaign = await db.query.campaigns.findFirst({
		where: eq(campaigns.slug, params.slug)
	});

	if (!campaign) {
		return error(404, 'Campaign not found');
	}

	const userRole = locals.session.role as 'dm' | 'player' | undefined;
	if (!userRole) {
		return error(403, 'Invalid session');
	}

	// Get existing marker
	const existingMarker = await db.query.mapMarkers.findFirst({
		where: and(eq(mapMarkers.id, markerId), eq(mapMarkers.campaignId, campaign.id))
	});

	if (!existingMarker) {
		return error(404, 'Marker not found');
	}

	// Permission check: Players can only delete their own markers, DM can delete all
	if (userRole === 'player' && existingMarker.authorRole !== 'player') {
		return error(403, 'You can only delete your own markers');
	}

	// Delete marker
	await db.delete(mapMarkers).where(eq(mapMarkers.id, markerId));

	// Emit SSE event
	emitEvent(params.slug, 'marker:deleted', {
		id: markerId,
		x: existingMarker.x,
		y: existingMarker.y
	});

	return json({ success: true });
};
