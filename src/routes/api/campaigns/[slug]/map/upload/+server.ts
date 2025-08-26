import type { RequestHandler } from './$types';
import { json, error } from '@sveltejs/kit';
import { requireAuth } from '$lib/server/session';
import { saveMapImage, type UploadResult } from '$lib/server/uploads';

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
