import { getCampaignTokens } from '$lib/server/campaign';
import { error, redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals, params, depends }) => {
	if (!locals.session) {
		throw redirect(302, '/');
	}

	if (locals.session.campaignSlug !== params.slug || locals.session.role !== 'dm') {
		throw error(403, 'Access denied');
	}

	depends('campaign:tokens');

	const campaignTokens = await getCampaignTokens(locals.session.campaignId);

	if (!campaignTokens) {
		throw error(404, "Couldn't retrieve tokens.");
	}

	return {
		session: locals.session,
		...campaignTokens
	};
};
