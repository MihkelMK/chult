import { db } from '$lib/server/db';
import { campaigns } from '$lib/server/db/schema';
import { requireAuth } from '$lib/server/session';
import { saveMapImage, type UploadResult } from '$lib/server/uploads';
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

		if (!file) {
			return error(400, 'No file uploaded');
		}

		const result = await saveMapImage(session.campaignSlug, file);

		if (!result.success) {
			return error(400, result.error || 'Upload failed');
		}

		// Update the campaign in database
		const dbResult = await db
			.update(campaigns)
			.set({
				imageHeight: result.originalDimensions?.height,
				imageWidth: result.originalDimensions?.width,
				updatedAt: new Date()
			})
			.where(eq(campaigns.slug, session.campaignSlug))
			.returning({
				imageHeight: campaigns.imageHeight,
				imageWidth: campaigns.imageWidth
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
		const { deleteMapImage } = await import('$lib/server/uploads');
		await deleteMapImage(session.campaignSlug);

		return json({ success: true });
	} catch (err) {
		console.error('Map deletion error:', err);
		return error(500, 'Deletion failed');
	}
};
