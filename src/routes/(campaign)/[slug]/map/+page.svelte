<script lang="ts">
	import MapView from '$lib/components/MapView.svelte';
	import type { PageData } from './$types';
	import type { TileCoords } from '$lib/types';
	import {
		createPlayerTileManager,
		type PlayerTileState
	} from '$lib/stores/playerTileManager.svelte';
	import { onDestroy } from 'svelte';
	import { getCampaignState } from '$lib/contexts/campaignContext';

	interface Props {
		data: PageData;
	}

	let { data }: Props = $props();

	const campaignState = getCampaignState();
	const playerTileManager = createPlayerTileManager(
		data.campaign.slug,
		data.revealedTiles.map((tile) => ({ x: tile.x, y: tile.y })),
		data.revealedTiles.length > 0
			? { x: data.revealedTiles[0].x, y: data.revealedTiles[0].y }
			: null,
		campaignState
	);

	let tileState = $state<PlayerTileState>({
		revealed: data.revealedTiles.map((tile) => ({ x: tile.x, y: tile.y })),
		pending: null,
		error: null,
		currentPosition: null
	});

	const unsubscribe = playerTileManager.subscribe((state) => {
		tileState = state;
	});

	onDestroy(unsubscribe);

	function handleTileAction(coords: TileCoords) {
		// Player navigation
		playerTileManager.navigate(coords);
	}

	// Clear error after 5 seconds
	$effect(() => {
		if (tileState.error) {
			const timer = setTimeout(() => {
				playerTileManager.clearError();
			}, 5000);

			return () => clearTimeout(timer);
		}
	});
</script>

<svelte:head>
	<title>Explore {data.campaign.name}</title>
</svelte:head>

<MapView
	{data}
	mode="player"
	{tileState}
	tileManager={playerTileManager}
	onTileAction={handleTileAction}
/>
