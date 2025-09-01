import type { RequestHandler } from './$types';
import { json, error } from '@sveltejs/kit';
import { requireAuth } from '$lib/server/session';
import { generateMapVariants, generateMapSrcSet, hasMapImage } from '$lib/server/imgproxy';
import type { MapUrlsResponse } from '$lib/types';

export const GET: RequestHandler = async (event) => {
	const session = requireAuth(event);

	if (!session) {
		return error(401, 'Unauthorized');
	}

	if (session.campaignSlug !== event.params.slug) {
		return error(403, 'Access denied');
	}

	try {
		const mapExists = await hasMapImage(session.campaignSlug);

		if (!mapExists) {
			return error(404, 'Map not found');
		}

		const variants = generateMapVariants(session.campaignSlug);
		const srcSet = generateMapSrcSet(session.campaignSlug);

		const response: MapUrlsResponse = {
			variants,
			responsive: srcSet,
			timestamp: Date.now() // For cache busting
		};
		return json(response);
	} catch (err) {
		console.error('Error generating map URLs:', err);
		return error(500, 'Failed to generate URLs');
	}
};
