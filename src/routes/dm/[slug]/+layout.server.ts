import { getCampaignData } from '$lib/server/campaign';
import type { LayoutServerLoad } from './$types';
import { error, redirect } from '@sveltejs/kit';

export const load: LayoutServerLoad = async ({ locals, params, depends }) => {
	if (!locals.session || locals.session.role !== 'dm') {
		throw redirect(302, '/');
	}

	if (locals.session.campaignSlug !== params.slug) {
		throw error(403, 'Access denied');
	}

	depends('campaign:data');

	const campaignData = await getCampaignData(locals.session.campaignId, false);

	if (!campaignData) {
		throw error(404, 'Campaign not found');
	}

	return {
		session: locals.session,
		...campaignData
	};
};
