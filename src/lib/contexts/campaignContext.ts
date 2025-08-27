import { setContext, getContext } from 'svelte';
import type { CampaignState } from '$lib/stores/campaignState';

const CAMPAIGN_STATE_KEY = Symbol('campaign_state');

export function setCampaignState(state: CampaignState) {
	setContext(CAMPAIGN_STATE_KEY, state);
}

export function getCampaignState(): CampaignState {
	return getContext<CampaignState>(CAMPAIGN_STATE_KEY);
}
