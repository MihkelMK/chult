import { db } from '$lib/server/db';
import { campaigns, gameSessions } from '$lib/server/db/schema';
import { emitEvent } from '$lib/server/events';
import { error, isHttpError, json } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import type { RequestHandler } from './$types';

export const DELETE: RequestHandler = async ({ locals, params }) => {
  if (!locals.session || locals.session.role !== 'dm') {
    throw error(403, 'Only DMs can delete sessions');
  }

  if (locals.session.campaignSlug !== params.slug) {
    throw error(403, 'Access denied');
  }

  const sessionId = parseInt(params.id);
  if (isNaN(sessionId)) {
    throw error(400, 'Invalid session ID');
  }

  try {
    // Get campaign
    const [campaign] = await db.select().from(campaigns).where(eq(campaigns.slug, params.slug)).limit(1);

    if (!campaign) {
      throw error(404, 'Campaign not found');
    }

    // Get the session to verify it exists and belongs to this campaign
    const [session] = await db.select().from(gameSessions).where(eq(gameSessions.id, sessionId)).limit(1);

    if (!session) {
      throw error(404, 'Session not found');
    }

    if (session.campaignId !== campaign.id) {
      throw error(403, 'Session does not belong to this campaign');
    }

    // Delete the session (paths will be cascade deleted)
    await db.delete(gameSessions).where(eq(gameSessions.id, sessionId));

    // Emit SSE event
    emitEvent(params.slug, 'session:deleted', { id: sessionId });

    return json({ success: true });
  } catch (err) {
    // HttpError is not an Error subclass, so it must be re-thrown explicitly to keep its status
    if (isHttpError(err)) throw err;
    console.error('Failed to delete session:', err);
    throw error(500, 'Failed to delete session');
  }
};
