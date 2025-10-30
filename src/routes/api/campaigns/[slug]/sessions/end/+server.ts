import { db } from '$lib/server/db';
import { campaigns, gameSessions } from '$lib/server/db/schema';
import { emitEvent } from '$lib/server/events';
import { error, json } from '@sveltejs/kit';
import { and, eq } from 'drizzle-orm';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ locals, params }) => {
	if (!locals.session || locals.session.role !== 'dm') {
		throw error(403, 'Only DMs can end sessions');
	}

	if (locals.session.campaignSlug !== params.slug) {
		throw error(403, 'Access denied');
	}

	try {
		// Get campaign
		const [campaign] = await db
			.select()
			.from(campaigns)
			.where(eq(campaigns.slug, params.slug))
			.limit(1);

		if (!campaign) {
			throw error(404, 'Campaign not found');
		}

		// Get active session
		const [activeSession] = await db
			.select()
			.from(gameSessions)
			.where(and(eq(gameSessions.campaignId, campaign.id), eq(gameSessions.isActive, true)))
			.limit(1);

		if (!activeSession) {
			throw error(400, 'No active session to end');
		}

		// Calculate duration in minutes
		const now = new Date();
		const durationMs = now.getTime() - new Date(activeSession.startedAt).getTime();
		const durationMinutes = Math.floor(durationMs / 60000);

		// Update session
		const [updatedSession] = await db
			.update(gameSessions)
			.set({
				isActive: false,
				endedAt: now,
				endGameTime: campaign.globalGameTime,
				duration: durationMinutes
			})
			.where(eq(gameSessions.id, activeSession.id))
			.returning();

		// Emit SSE event
		emitEvent(params.slug, 'session:ended', updatedSession);

		return json(updatedSession);
	} catch (err) {
		console.error('Failed to end session:', err);
		if (err instanceof Error && 'status' in err) {
			throw err;
		}
		throw error(500, 'Failed to end session');
	}
};
