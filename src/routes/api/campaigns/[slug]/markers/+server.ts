import { db } from '$lib/server/db';
import { campaigns, mapMarkers } from '$lib/server/db/schema';
import { emitEvent } from '$lib/server/events';
import { type MarkerType } from '$lib/types';
import { MARKER_TYPES } from '$lib/utils/mapMarkers';
import { error, json } from '@sveltejs/kit';
import { and, eq } from 'drizzle-orm';
import type { RequestHandler } from './$types';

// POST /api/campaigns/[slug]/markers - Create new marker
export const POST: RequestHandler = async ({ params, locals, request }) => {
	if (!locals.session) {
		return error(401, 'Unauthorized');
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

	// Parse request body
	const body = await request.json();
	const { x, y, type, title, content, visibleToPlayers, imagePath } = body;

	// Validation
	if (typeof x !== 'number' || typeof y !== 'number') {
		return error(400, 'Invalid coordinates');
	}

	if (!type || !MARKER_TYPES.includes(type as MarkerType)) {
		return error(400, 'Invalid marker type');
	}

	if (!title || typeof title !== 'string' || title.trim().length === 0) {
		return error(400, 'Title is required');
	}

	if (!visibleToPlayers && typeof visibleToPlayers !== 'boolean') {
		return error(400, 'Invalid visibleToPlayers value');
	}

	if (content !== null && typeof content !== 'string') {
		return error(400, 'Invalid content');
	}

	if (imagePath !== null && typeof imagePath !== 'string') {
		return error(400, 'Invalid imagePath');
	}

	// Players can only create visible markers
	const requestedVisibility = visibleToPlayers ?? true;
	if (userRole === 'player' && !requestedVisibility) {
		return error(403, 'Players can only create visible markers');
	}

	// Check if marker with same visibility already exists at this location
	const existingMarker = await db.query.mapMarkers.findFirst({
		where: and(
			eq(mapMarkers.campaignId, campaign.id),
			eq(mapMarkers.x, x),
			eq(mapMarkers.y, y),
			eq(mapMarkers.visibleToPlayers, requestedVisibility)
		)
	});

	if (existingMarker) {
		const markerType = requestedVisibility ? 'player marker' : 'DM marker';
		return error(409, `A ${markerType} already exists at this location`);
	}

	// Create marker
	const [newMarker] = await db
		.insert(mapMarkers)
		.values({
			campaignId: campaign.id,
			x,
			y,
			type,
			title: title.trim(),
			content: content?.trim() || null,
			imagePath: imagePath || null,
			authorRole: userRole,
			visibleToPlayers: requestedVisibility // Use validated visibility
		})
		.returning();

	// Emit SSE event
	emitEvent(params.slug, 'marker:created', newMarker);

	return json(newMarker, { status: 201 });
};
