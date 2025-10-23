import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { campaigns, sessions, paths } from '$lib/server/db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { emitEvent } from '$lib/server/events';

export const POST: RequestHandler = async ({ locals, params }) => {
	if (!locals.session || locals.session.role !== 'dm') {
		throw error(403, 'Only DMs can start sessions');
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

		// Check if there's already an active session
		const [activeSession] = await db
			.select()
			.from(sessions)
			.where(and(eq(sessions.campaignId, campaign.id), eq(sessions.isActive, true)))
			.limit(1);

		if (activeSession) {
			throw error(400, 'A session is already active');
		}

		// Get the next session number
		const [lastSession] = await db
			.select({ sessionNumber: sessions.sessionNumber })
			.from(sessions)
			.where(eq(sessions.campaignId, campaign.id))
			.orderBy(desc(sessions.sessionNumber))
			.limit(1);

		const sessionNumber = (lastSession?.sessionNumber || 0) + 1;

		// Generate session name
		const now = new Date();
		const dateStr = now.toISOString().split('T')[0];
		const name = `Session ${sessionNumber} - ${dateStr}`;

		// Create session
		const [newSession] = await db
			.insert(sessions)
			.values({
				campaignId: campaign.id,
				sessionNumber,
				name,
				startGameTime: campaign.globalGameTime,
				isActive: true
			})
			.returning();

		// Create empty path for this session
		await db.insert(paths).values({
			sessionId: newSession.id,
			steps: [],
			revealedTiles: []
		});

		// Emit SSE event
		emitEvent(params.slug, 'session:started', newSession);

		return json(newSession);
	} catch (err) {
		console.error('Failed to start session:', err);
		if (err instanceof Error && 'status' in err) {
			throw err;
		}
		throw error(500, 'Failed to start session');
	}
};
