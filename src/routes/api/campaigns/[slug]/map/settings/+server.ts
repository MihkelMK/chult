import { db } from '$lib/server/db/index';
import { campaigns } from '$lib/server/db/schema';
import { error, json } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import type { RequestHandler } from './$types';

export const PATCH: RequestHandler = async ({ params, request, locals }) => {
	// Verify authentication
	if (!locals.session) {
		throw error(401, 'Unauthorized');
	}

	// Verify DM permission
	if (locals.session.role !== 'dm') {
		throw error(403, 'Only DMs can update hex grid settings');
	}

	// Verify campaign ownership
	if (locals.session.campaignSlug !== params.slug) {
		throw error(403, 'Access denied');
	}

	try {
		const body = await request.json();
		const { hexesPerRow, hexesPerCol, hexOffsetX, hexOffsetY } = body;

		// Validate input
		if (
			typeof hexesPerRow !== 'number' ||
			hexesPerRow < 5 ||
			hexesPerRow > 100 ||
			typeof hexesPerCol !== 'number' ||
			hexesPerCol < 5 ||
			hexesPerCol > 100 ||
			typeof hexOffsetX !== 'number' ||
			hexOffsetX < -200 ||
			hexOffsetX > 200 ||
			typeof hexOffsetY !== 'number' ||
			hexOffsetY < -200 ||
			hexOffsetY > 200
		) {
			throw error(400, 'Invalid hex grid configuration values');
		}

		// Update the campaign in database
		const result = await db
			.update(campaigns)
			.set({
				hexesPerRow,
				hexesPerCol,
				hexOffsetX,
				hexOffsetY,
				updatedAt: new Date()
			})
			.where(eq(campaigns.slug, params.slug))
			.returning({
				hexesPerRow: campaigns.hexesPerRow,
				hexesPerCol: campaigns.hexesPerCol,
				hexOffsetX: campaigns.hexOffsetX,
				hexOffsetY: campaigns.hexOffsetY
			});

		if (result.length === 0) {
			throw error(404, 'Campaign not found');
		}

		return json({
			success: true,
			message: 'Hex grid configuration updated successfully',
			config: result[0]
		});
	} catch (err) {
		console.error('Error updating hex grid configuration:', err);
		if (err instanceof Error && err.message.includes('Invalid')) {
			throw error(400, err.message);
		}
		throw error(500, 'Failed to update hex grid configuration');
	}
};
