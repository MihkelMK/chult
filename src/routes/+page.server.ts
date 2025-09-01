import type { Actions } from './$types';
import { fail, redirect } from '@sveltejs/kit';
import { validateCampaignAccess, createSession } from '$lib/server/session';

export const actions: Actions = {
	access: async (event) => {
		const data = await event.request.formData();
		const campaignSlug = data.get('campaignSlug')?.toString();
		const accessToken = data.get('accessToken')?.toString();

		if (!campaignSlug || !accessToken) {
			return fail(400, { message: 'Campaign code and access token are required' });
		}

		const validation = await validateCampaignAccess(campaignSlug, accessToken);

		if (!validation) {
			return fail(401, { message: 'Invalid campaign code or access token' });
		}

		// Create session
		createSession(event, {
			campaignId: validation.campaign.id,
			campaignSlug: validation.campaign.slug,
			role: validation.role
		});

		throw redirect(302, `/${campaignSlug}`);
	}
};
