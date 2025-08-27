<script lang="ts">
	import { getDIContainer } from '$lib/contexts/diContext';
	import { setCampaignState } from '$lib/contexts/campaignContext';
	import type { LayoutProps } from './$types';
	import { DMCampaignState } from '$lib/stores/dmCampaignState.svelte';

	let { data, children }: LayoutProps = $props();

	const container = getDIContainer();
	const campaignState = container.resolve(
		Symbol.for('DMCampaignState'),
		data,
		data.campaign.slug
	) as DMCampaignState;
	setCampaignState(campaignState);
</script>

{@render children?.()}
