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
		const {
			hexesPerRow,
			hexesPerCol,
			hexOffsetX,
			hexOffsetY,
			partyTokenX,
			partyTokenY,
			hasPlayerMap
		} = body;

		// Build update object dynamically based on what was provided
		const updateData: Record<string, number | Date | null | boolean> = {
			updatedAt: new Date()
		};

		// Validate and add hex grid settings if provided
		if (hexesPerRow !== undefined) {
			if (typeof hexesPerRow !== 'number' || hexesPerRow < 5 || hexesPerRow > 100) {
				throw error(400, 'Invalid hexesPerRow value');
			}
			updateData.hexesPerRow = hexesPerRow;
		}

		if (hexesPerCol !== undefined) {
			if (typeof hexesPerCol !== 'number' || hexesPerCol < 5 || hexesPerCol > 100) {
				throw error(400, 'Invalid hexesPerCol value');
			}
			updateData.hexesPerCol = hexesPerCol;
		}

		if (hexOffsetX !== undefined) {
			if (typeof hexOffsetX !== 'number' || hexOffsetX < -200 || hexOffsetX > 200) {
				throw error(400, 'Invalid hexOffsetX value');
			}
			updateData.hexOffsetX = hexOffsetX;
		}

		if (hexOffsetY !== undefined) {
			if (typeof hexOffsetY !== 'number' || hexOffsetY < -200 || hexOffsetY > 200) {
				throw error(400, 'Invalid hexOffsetY value');
			}
			updateData.hexOffsetY = hexOffsetY;
		}

		// Validate and add party token position if provided
		if (partyTokenX !== undefined) {
			if (partyTokenX !== null && typeof partyTokenX !== 'number') {
				throw error(400, 'Invalid partyTokenX value');
			}
			updateData.partyTokenX = partyTokenX;
		}

		if (partyTokenY !== undefined) {
			if (partyTokenY !== null && typeof partyTokenY !== 'number') {
				throw error(400, 'Invalid partyTokenY value');
			}
			updateData.partyTokenY = partyTokenY;
		}

		// Validate and add hasPlayerMap flag if provided
		if (hasPlayerMap !== undefined) {
			if (typeof hasPlayerMap !== 'boolean') {
				throw error(400, 'Invalid hasPlayerMap value');
			}
			updateData.hasPlayerMap = hasPlayerMap;
		}

		// Update the campaign in database
		const result = await db
			.update(campaigns)
			.set(updateData)
			.where(eq(campaigns.slug, params.slug))
			.returning({
				hexesPerRow: campaigns.hexesPerRow,
				hexesPerCol: campaigns.hexesPerCol,
				hexOffsetX: campaigns.hexOffsetX,
				hexOffsetY: campaigns.hexOffsetY,
				partyTokenX: campaigns.partyTokenX,
				partyTokenY: campaigns.partyTokenY,
				hasPlayerMap: campaigns.hasPlayerMap
			});

		if (result.length === 0) {
			throw error(404, 'Campaign not found');
		}

		return json({
			success: true,
			message: 'Campaign settings updated successfully',
			config: result[0]
		});
	} catch (err) {
		console.error('Error updating campaign settings:', err);
		if (err instanceof Error && err.message.includes('Invalid')) {
			throw error(400, err.message);
		}
		throw error(500, 'Failed to update campaign settings');
	}
};
