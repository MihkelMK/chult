import { db } from '#lib/server/db/index.ts';
import { revealedTiles } from '#lib/server/db/schema.ts';
import { requireAuth } from '#lib/server/session.ts';
import { error } from '@sveltejs/kit';
import { and, eq } from 'drizzle-orm';
import type { RequestHandler } from './$types';

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
      .where(and(eq(revealedTiles.campaignId, session.campaignId), eq(revealedTiles.x, x), eq(revealedTiles.y, y)));

    return Response.json({ success: true });
  } catch (err) {
    console.error('Hide tile error:', err);
    return error(500, 'Failed to hide tile');
  }
};
