import { db } from '$lib/server/db';
import { campaigns } from '$lib/server/db/schema';
import { requireAuth } from '$lib/server/session';
import { saveMapImage, type UploadResult } from '$lib/server/uploads';
import type { UserRole } from '$lib/types';
import { error, json } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
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
		const formData = await event.request.formData();
		const file = formData.get('map') as File;
		const mapType = (event.url.searchParams.get('mapType') as UserRole) || 'dm';

		if (!file) {
			return error(400, 'No file uploaded');
		}

		const result = await saveMapImage(session.campaignSlug, file, mapType);

		if (!result.success) {
			return error(400, result.error || 'Upload failed');
		}

		// Update the campaign in database
		const updateData: Record<string, unknown> = {
			updatedAt: new Date()
		};

		// Only update dimensions for DM map
		if (mapType === 'dm') {
			updateData.imageHeight = result.originalDimensions?.height;
			updateData.imageWidth = result.originalDimensions?.width;
		} else {
			// Set hasPlayerMap to true when uploading player map
			updateData.hasPlayerMap = true;
		}

		const dbResult = await db
			.update(campaigns)
			.set(updateData)
			.where(eq(campaigns.slug, session.campaignSlug))
			.returning({
				imageHeight: campaigns.imageHeight,
				imageWidth: campaigns.imageWidth,
				hasPlayerMap: campaigns.hasPlayerMap
			});

		if (dbResult.length === 0) {
			throw error(404, 'Campaign not found');
		}

		const response: UploadResult = {
			success: true,
			filename: result.filename,
			originalDimensions: result.originalDimensions
		};
		return json(response);
	} catch (err) {
		console.error('Map upload error:', err);
		return error(500, 'Upload failed');
	}
};

export const DELETE: RequestHandler = async (event) => {
	const session = requireAuth(event, 'dm');

	if (!session) {
		return error(401, 'Unauthorized');
	}

	if (session.campaignSlug !== event.params.slug) {
		return error(403, 'Access denied');
	}

	try {
		const mapType = (event.url.searchParams.get('mapType') as UserRole) || 'dm';
		const { deleteMapImage } = await import('$lib/server/uploads');
		await deleteMapImage(session.campaignSlug, mapType);

		// If deleting player map, update hasPlayerMap flag
		if (mapType === 'player') {
			await db
				.update(campaigns)
				.set({
					hasPlayerMap: false,
					updatedAt: new Date()
				})
				.where(eq(campaigns.slug, session.campaignSlug));
		}

		return json({ success: true });
	} catch (err) {
		console.error('Map deletion error:', err);
		return error(500, 'Deletion failed');
	}
};
