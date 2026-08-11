import { db } from '$lib/server/db';
import { campaigns, mapMarkers } from '$lib/server/db/schema';
import { emitEvent } from '$lib/server/events';
import { type MarkerType } from '$lib/types';
import { MARKER_TYPES } from '$lib/utils/mapMarkers';
import { error, json } from '@sveltejs/kit';
import { and, eq } from 'drizzle-orm';
import type { RequestHandler } from './$types';

type PatchMarkerInput = {
  type?: MarkerType;
  title?: string;
  content?: string | null;
  visibleToPlayers?: boolean;
  imagePath?: string | null;
};

function parsePatchMarkerBody(body: Record<string, unknown>): PatchMarkerInput {
  const { type, title, content, visibleToPlayers, imagePath } = body;

  if (type !== undefined && !MARKER_TYPES.includes(type as MarkerType)) error(400, 'Invalid marker type');
  if (title !== undefined && (typeof title !== 'string' || title.trim().length === 0)) error(400, 'Title cannot be empty');
  if (content !== undefined && content !== null && typeof content !== 'string') error(400, 'Invalid content');
  if (visibleToPlayers !== undefined && typeof visibleToPlayers !== 'boolean') error(400, 'Invalid visibleToPlayers value');
  if (imagePath !== undefined && imagePath !== null && typeof imagePath !== 'string') error(400, 'Invalid imagePath');

  // `error()` returns never, so the guards above already narrowed everything except `type`
  // (Array.includes() is not a type predicate)
  return { type: type as MarkerType | undefined, title, content, visibleToPlayers, imagePath };
}

function buildMarkerUpdates(input: PatchMarkerInput) {
  const updates: Partial<typeof mapMarkers.$inferInsert> = { updatedAt: new Date() };

  if (input.type !== undefined) updates.type = input.type;
  if (input.title !== undefined) updates.title = input.title.trim();
  if (input.content !== undefined) updates.content = input.content?.trim() || null;
  if (input.visibleToPlayers !== undefined) updates.visibleToPlayers = input.visibleToPlayers;
  if (input.imagePath !== undefined) updates.imagePath = input.imagePath || null;

  return updates;
}

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
    where: eq(campaigns.slug, params.slug),
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
    where: and(eq(mapMarkers.id, markerId), eq(mapMarkers.campaignId, campaign.id)),
  });

  if (!existingMarker) {
    return error(404, 'Marker not found');
  }

  // Permission check: Players can only edit their own markers, DM can edit all
  if (userRole === 'player' && existingMarker.authorRole !== 'player') {
    return error(403, 'You can only edit your own markers');
  }

  const updates = buildMarkerUpdates(parsePatchMarkerBody(await request.json()));

  // Update marker
  const [updatedMarker] = await db.update(mapMarkers).set(updates).where(eq(mapMarkers.id, markerId)).returning();

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
    where: eq(campaigns.slug, params.slug),
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
    where: and(eq(mapMarkers.id, markerId), eq(mapMarkers.campaignId, campaign.id)),
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
    y: existingMarker.y,
  });

  return json({ success: true });
};
