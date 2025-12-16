<script lang="ts">
	import { setLocalState } from '$lib/contexts/campaignContext';
	import { getDIContainer } from '$lib/contexts/diContext';
	import type { LocalState } from '$lib/stores/localState.svelte';
	import { LocalStateDM } from '$lib/stores/localStateDM.svelte';
	import { LocalStatePlayer } from '$lib/stores/localStatePlayer.svelte';
	import type { LayoutProps } from './$types';

	let { data, children }: LayoutProps = $props();

	// Determine effective role from session
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
</script>

<div class="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
	<main>
		{@render children()}
	</main>
</div>
