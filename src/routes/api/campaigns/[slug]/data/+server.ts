import { getCampaignData } from '$lib/server/campaign';
import { requireAuth } from '$lib/server/session';
import type { CampaignDataResponse } from '$lib/types';
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

  // Match the layout load: a DM previewing as a player must resync with player data.
  const effectiveRole = session.viewAs || session.role;
  const campaignData = (await getCampaignData(session.campaignId, effectiveRole === 'player')) as CampaignDataResponse;

  if (!campaignData) {
    return error(404, 'Campaign not found');
  }

  return json(campaignData);
};
