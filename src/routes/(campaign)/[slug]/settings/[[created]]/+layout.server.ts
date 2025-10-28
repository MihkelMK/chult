import { getCampaignTokens } from '$lib/server/campaign';
import { getMapUrls } from '$lib/server/imgproxy';
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

	// Load both DM and player map URLs for the settings page preview
	const [dmMapUrls, playerMapUrls] = await Promise.all([
		getMapUrls(params.slug, 'dm'),
		getMapUrls(params.slug, 'player')
	]);

	return {
		session: locals.session,
		...campaignTokens,
		dmMapUrls,
		playerMapUrls
	};
};
