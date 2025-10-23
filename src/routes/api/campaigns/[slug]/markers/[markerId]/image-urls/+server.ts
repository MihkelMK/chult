import { generateMarkerImageVariants, hasMarkerImage } from '$lib/server/imgproxy';
import { requireAuth } from '$lib/server/session';
import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async (event) => {
	const session = requireAuth(event);

	if (!session) {
		return error(401, 'Unauthorized');
	}

	if (session.campaignSlug !== event.params.slug) {
		return error(403, 'Access denied');
	}

	const markerId = parseInt(event.params.markerId);
	if (isNaN(markerId)) {
		return error(400, 'Invalid marker ID');
	}

	try {
		const imageExists = await hasMarkerImage(session.campaignSlug, markerId);

		if (!imageExists) {
			return error(404, 'Marker image not found');
		}

		const variants = generateMarkerImageVariants(session.campaignSlug, markerId);

		const response = {
			variants,
			src: variants.medium, // Default fallback
			timestamp: Date.now() // For cache busting
		};

		return json(response);
	} catch (err) {
		console.error('Error generating marker image URLs:', err);
		return error(500, 'Failed to generate URLs');
	}
};
