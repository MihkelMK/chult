<script lang="ts">
	import MapView from '$lib/components/MapView.svelte';
	import { getLocalState, setRemoteState } from '$lib/contexts/campaignContext';
	import type { LocalStateDM } from '$lib/stores/localStateDM.svelte';
	import type { LocalStatePlayer } from '$lib/stores/localStatePlayer.svelte';
	import { RemoteStateDM } from '$lib/stores/remoteStateDM.svelte';
	import { RemoteStatePlayer } from '$lib/stores/remoteStatePlayer.svelte';
	import type { PageData } from './$types';

	interface Props {
		data: PageData;
	}

	let { data }: Props = $props();

	// Determine effective role from session
	const effectiveRole = data.session ? data.session.viewAs || data.session.role : 'player';
	const isDM = effectiveRole === 'dm';

	const localState = getLocalState();

	// Create appropriate remote state based on effective role
	const remoteState = isDM
		? new RemoteStateDM(data.campaign.slug, localState as LocalStateDM)
		: new RemoteStatePlayer(data.campaign.slug, localState as LocalStatePlayer);

	// Set remote state in context for child components
	setRemoteState(remoteState);
</script>

<svelte:head>
	<title>{isDM ? 'Interactive Map' : 'Explore'} - {data.campaign.name}</title>
</svelte:head>

<MapView {data} mode={isDM ? 'dm' : 'player'} />
