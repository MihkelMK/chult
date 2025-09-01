<script lang="ts">
	import { DIContainer, setDIContainer } from '$lib/contexts/diContext';
	import { DMCampaignState } from '$lib/stores/dmCampaignState.svelte';
	import { PlayerCampaignState } from '$lib/stores/playerCampaignState.svelte';

	const container = new DIContainer();
	container.register(Symbol.for('DMCampaignState'), DMCampaignState);
	container.register(Symbol.for('PlayerCampaignState'), PlayerCampaignState);
	setDIContainer(container);

	let { children } = $props();
</script>

{@render children?.()}
