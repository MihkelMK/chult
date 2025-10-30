import { db } from '$lib/server/db';
import { campaigns, timeAuditLog } from '$lib/server/db/schema';
import { emitEvent } from '$lib/server/events';
import { error, json } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ params, request, locals }) => {
	if (!locals.session || locals.session.role !== 'dm') {
		throw error(403, 'Only DMs can adjust time');
	}

	if (locals.session.campaignSlug !== params.slug) {
		throw error(403, 'Access denied');
	}

	try {
		const body = await request.json();
		const { delta, notes } = body;

		// Validate input
		if (typeof delta !== 'number' || isNaN(delta)) {
			return error(400, 'Invalid time delta');
		}

		if (delta === 0) {
			return error(400, 'Time delta cannot be zero');
		}

		// Get current campaign state
		const [campaign] = await db
			.select()
			.from(campaigns)
			.where(eq(campaigns.slug, params.slug))
			.limit(1);

		if (!campaign) {
			throw error(404, 'Campaign not found');
		}

		// Calculate new global game time
		const newGlobalGameTime = campaign.globalGameTime + delta;

		// Prevent negative time
		if (newGlobalGameTime < 0) {
			return error(400, 'Cannot adjust time to negative value');
		}

		// Update campaign global game time
		await db
			.update(campaigns)
			.set({ globalGameTime: newGlobalGameTime })
			.where(eq(campaigns.id, campaign.id));

		// Create audit log entry
		const [auditEntry] = await db
			.insert(timeAuditLog)
			.values({
				campaignId: campaign.id,
				type: 'dm_adjust',
				amount: delta,
				actorRole: 'dm',
				notes: notes || null
			})
			.returning();

		// Emit SSE event for real-time updates
		emitEvent(params.slug, 'time:updated', {
			globalGameTime: newGlobalGameTime,
			auditEntry: {
				id: auditEntry.id,
				timestamp: auditEntry.timestamp,
				type: auditEntry.type,
				amount: auditEntry.amount,
				actorRole: auditEntry.actorRole,
				notes: auditEntry.notes
			}
		});

		return json({
			success: true,
			globalGameTime: newGlobalGameTime,
			auditEntry: {
				id: auditEntry.id,
				timestamp: auditEntry.timestamp,
				type: auditEntry.type,
				amount: auditEntry.amount,
				actorRole: auditEntry.actorRole,
				notes: auditEntry.notes
			}
		});
	} catch (err) {
		console.error('Error adjusting time:', err);
		return error(500, 'Failed to adjust time');
	}
};
