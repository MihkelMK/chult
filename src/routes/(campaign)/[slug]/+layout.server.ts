import { getCampaignData } from '$lib/server/campaign';
import type { PlayerCampaignDataResponse } from '$lib/types/database';
import { error, redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals, params, depends }) => {
	if (!locals.session) {
		throw redirect(302, '/');
	}

	if (locals.session.campaignSlug !== params.slug) {
		throw redirect(302, `/${locals.session.campaignSlug}`);
	}

	depends('campaign:data');

	const campaignData = (await getCampaignData(
		locals.session.campaignId,
		true
	)) as PlayerCampaignDataResponse;

	if (!campaignData) {
		throw error(404, 'Campaign not found');
	}

	return {
		session: locals.session,
		...campaignData
	};
};
