import { PRIVATE_DM_TOKEN } from '$app/env/private';
import { createCampaign } from '#lib/server/campaign.ts';
import { createSession } from '#lib/server/session.ts';
import type { Campaign } from '#lib/types/index.ts';
import { fail, redirect } from '@sveltejs/kit';
import type { Actions } from './$types';

export const actions: Actions = {
  create: async (event) => {
    const data = await event.request.formData();
    const campaignName = data.get('campaignName')?.toString();
    const accessToken = data.get('accessToken')?.toString();

    if (!campaignName) {
      return fail(400, {
        error: 'Campaign name is required',
        campaignName,
      });
    }

    if (accessToken !== PRIVATE_DM_TOKEN) {
      return fail(401, { error: 'Invalid DM token', campaignName });
    }

    let campaign: Campaign;
    try {
      campaign = await createCampaign(campaignName);
    } catch (err) {
      console.error('Campaign creation error:', err);

      return fail(400, {
        error: err instanceof Error ? err.message : 'Failed to create campaign',
        campaignName,
      });
    }

    // Automatically log the creator in as DM
    createSession(event, {
      campaignId: campaign.id,
      campaignSlug: campaign.slug,
      role: 'dm',
    });

    // Redirect to DM view with success message
    throw redirect(302, `/${campaign.slug}/settings?created=true`);
  },
};
