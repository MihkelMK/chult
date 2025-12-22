<script lang="ts">
	import MapView from '$lib/components/MapView.svelte';
	import { getLocalState, setRemoteState } from '$lib/contexts/campaignContext';
	import type { LocalStateDM } from '$lib/stores/localStateDM.svelte';
	import type { LocalStatePlayer } from '$lib/stores/localStatePlayer.svelte';
	import { RemoteStateDM } from '$lib/stores/remoteStateDM.svelte';
	import { RemoteStatePlayer } from '$lib/stores/remoteStatePlayer.svelte';
	import { onMount } from 'svelte';
	import type { PageData } from './$types';

	interface Props {
		data: PageData;
	}

	let { data }: Props = $props();

	const effectiveRole = $derived(
		data.session ? data.session.viewAs || data.session.role : 'player'
	);
	const isDM = $derived(effectiveRole === 'dm');

	let ready = $state(false);

	// Determine effective role from session
	onMount(() => {
		const localState = getLocalState();

		// Create appropriate remote state based on effective role
		const remoteState = isDM
			? new RemoteStateDM(data.campaign.slug, localState as LocalStateDM)
			: new RemoteStatePlayer(data.campaign.slug, localState as LocalStatePlayer);

		// Set remote state in context for child components
		setRemoteState(remoteState);
		ready = true;
	});
</script>

<svelte:head>
	<title>{isDM ? 'Interactive Map' : 'Explore'} - {data.campaign.name}</title>
</svelte:head>

{#if ready}
	<MapView {data} {effectiveRole} userRole={data.session.role} />
{/if}
