import { db } from '$lib/server/db';
import { campaigns, mapMarkers } from '$lib/server/db/schema';
import { emitEvent } from '$lib/server/events';
import { type MarkerType } from '$lib/types';
import { MARKER_TYPES } from '$lib/utils/mapMarkers';
import { error, json } from '@sveltejs/kit';
import { and, eq } from 'drizzle-orm';
import type { RequestHandler } from './$types';

type CreateMarkerInput = {
  x: number;
  y: number;
  type: MarkerType;
  title: string;
  content: string | null;
  imagePath: string | null;
  visibleToPlayers: boolean | undefined;
};

function parseCreateMarkerBody(body: Record<string, unknown>): CreateMarkerInput {
  const { x, y, type, title, content, visibleToPlayers, imagePath } = body;

  if (typeof x !== 'number' || typeof y !== 'number') error(400, 'Invalid coordinates');
  if (!type || !MARKER_TYPES.includes(type as MarkerType)) error(400, 'Invalid marker type');
  if (!title || typeof title !== 'string' || title.trim().length === 0) error(400, 'Title is required');
  // undefined is allowed: `visibleToPlayers ?? true` below treats it as "default to visible"
  if (visibleToPlayers !== undefined && typeof visibleToPlayers !== 'boolean') error(400, 'Invalid visibleToPlayers value');
  if (content !== null && typeof content !== 'string') error(400, 'Invalid content');
  if (imagePath !== null && typeof imagePath !== 'string') error(400, 'Invalid imagePath');

  // `error()` returns never, so the guards above already narrowed everything except `type`
  // (Array.includes() is not a type predicate)
  return { x, y, type: type as MarkerType, title, content, imagePath, visibleToPlayers };
}

// POST /api/campaigns/[slug]/markers - Create new marker
export const POST: RequestHandler = async ({ params, locals, request }) => {
  if (!locals.session) {
    return error(401, 'Unauthorized');
  }

  // Get campaign and verify access
  const campaign = await db.query.campaigns.findFirst({
    where: eq(campaigns.slug, params.slug),
  });

  if (!campaign) {
    return error(404, 'Campaign not found');
  }

  const userRole = locals.session.role as 'dm' | 'player' | undefined;
  if (!userRole) {
    return error(403, 'Invalid session');
  }

  const { x, y, type, title, content, visibleToPlayers, imagePath } = parseCreateMarkerBody(await request.json());

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
    ),
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
      visibleToPlayers: requestedVisibility, // Use validated visibility
    })
    .returning();

  // Emit SSE event. DM-only markers are filtered out of the player page load, so they
  // must be withheld from the player event stream too.
  emitEvent(params.slug, 'marker:created', newMarker, newMarker.visibleToPlayers ? 'all' : 'dm');

  return json(newMarker, { status: 201 });
};
