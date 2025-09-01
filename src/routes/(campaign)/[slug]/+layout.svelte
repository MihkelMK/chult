<script lang="ts">
	import { getDIContainer } from '$lib/contexts/diContext';
	import { setCampaignState } from '$lib/contexts/campaignContext';
	import type { LayoutProps } from './$types';
	import { PlayerCampaignState } from '$lib/stores/playerCampaignState.svelte';

	let { data, children }: LayoutProps = $props();

	const container = getDIContainer();
	const campaignState = container.resolve(
		Symbol.for('PlayerCampaignState'),
		data,
		data.campaign.slug
	) as PlayerCampaignState;
	setCampaignState(campaignState);
</script>

<div class="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
	<main>
		{@render children()}
	</main>
</div>
