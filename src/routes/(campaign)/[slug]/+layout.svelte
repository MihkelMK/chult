<script lang="ts">
	import { setLocalState } from '$lib/contexts/campaignContext';
	import { getDIContainer } from '$lib/contexts/diContext';
	import type { LocalState } from '$lib/stores/localState.svelte';
	import { LocalStateDM } from '$lib/stores/localStateDM.svelte';
	import { LocalStatePlayer } from '$lib/stores/localStatePlayer.svelte';
	import { onMount } from 'svelte';
	import type { LayoutProps } from './$types';

	let { data, children }: LayoutProps = $props();

	let ready = $state(false);

	// Determine effective role from session
	onMount(() => {
		const effectiveRole = data.session ? data.session.viewAs || data.session.role : 'player';
		const isDM = effectiveRole === 'dm';

		const container = getDIContainer();
		const localState = isDM
			? (container.resolve(Symbol.for('LocalStateDM'), data, data.campaign.slug) as LocalStateDM)
			: (container.resolve(
					Symbol.for('LocalStatePlayer'),
					data,
					data.campaign.slug
				) as LocalStatePlayer);
		setLocalState(localState as LocalState);
		ready = true;
	});
</script>

<div class="min-h-screen bg-linear-to-br from-slate-50 to-blue-50">
	<main>
		{#if ready}
			{@render children()}
		{/if}
	</main>
</div>
