import { db } from '$lib/server/db';
import { campaigns, gameSessions, paths } from '$lib/server/db/schema';
import { emitEvent } from '$lib/server/events';
import { error, json } from '@sveltejs/kit';
import { and, desc, eq } from 'drizzle-orm';
import type { RequestHandler } from './$types';

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
			.from(gameSessions)
			.where(and(eq(gameSessions.campaignId, campaign.id), eq(gameSessions.isActive, true)))
			.limit(1);

		if (activeSession) {
			throw error(400, 'A session is already active');
		}

		// Get the next session number
		const [lastSession] = await db
			.select({ sessionNumber: gameSessions.sessionNumber })
			.from(gameSessions)
			.where(eq(gameSessions.campaignId, campaign.id))
			.orderBy(desc(gameSessions.sessionNumber))
			.limit(1);

		const sessionNumber = (lastSession?.sessionNumber || 0) + 1;

		// Generate session name
		const name = `Session ${sessionNumber}`;

		// Create session
		const [newSession] = await db
			.insert(gameSessions)
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
			gameSessionId: newSession.id,
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
