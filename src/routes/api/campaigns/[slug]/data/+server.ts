import type { RequestHandler } from './$types';
import { json, error } from '@sveltejs/kit';
import { getCampaignData } from '$lib/server/campaign';
import { requireAuth } from '$lib/server/session';
import type { CampaignDataResponse } from '$lib/types';

export const GET: RequestHandler = async (event) => {
	const session = requireAuth(event);

	if (!session) {
		return error(401, 'Unauthorized');
	}

	if (session.campaignSlug !== event.params.slug) {
		return error(403, 'Access denied');
	}

	const campaignData = (await getCampaignData(
		session.campaignId,
		session.role === 'player'
	)) as CampaignDataResponse;

	if (!campaignData) {
		return error(404, 'Campaign not found');
	}

	return json(campaignData);
};
