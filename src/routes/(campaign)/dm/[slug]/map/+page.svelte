<script lang="ts">
	import MapView from '$lib/components/MapView.svelte';
	import type { PageData } from './$types';
	import type { TileCoords } from '$lib/types';
	import { createTileManager, type TileState } from '$lib/stores/tileManager.svelte';
	import { onDestroy } from 'svelte';
	import { getCampaignState } from '$lib/contexts/campaignContext';

	interface Props {
		data: PageData;
	}

	let { data }: Props = $props();

	const campaignState = getCampaignState();
	const tileManager = createTileManager(
		data.session.campaignSlug,
		data.revealedTiles.map((tile) => ({ x: tile.x, y: tile.y })),
		campaignState
	);

	let tileState = $state<TileState>({ revealed: [], pending: [], errors: [] });
	const unsubscribe = tileManager.subscribe((state) => {
		tileState = state;
	});

	onDestroy(unsubscribe);

	let selectedTiles = $state<TileCoords[]>([]);

	function handleTileAction(coords: TileCoords) {
		// Single tile reveal/hide toggle
		const isRevealed = tileManager.isRevealed(coords, tileState);
		if (isRevealed) {
			tileManager.hideTile(coords);
		} else {
			tileManager.revealTile(coords);
		}
	}

	function handleMultiSelect(coords: TileCoords) {
		// Multi-select toggle
		const index = selectedTiles.findIndex((tile) => tile.x === coords.x && tile.y === coords.y);
		if (index > -1) {
			selectedTiles = selectedTiles.filter((_, i) => i !== index);
		} else {
			selectedTiles = [...selectedTiles, coords];
		}
	}
</script>

<svelte:head>
	<title>Interactive Map - {data.campaign.name}</title>
</svelte:head>

<MapView
	{data}
	mode="dm"
	{tileState}
	{tileManager}
	{selectedTiles}
	onTileAction={handleTileAction}
	onMultiSelect={handleMultiSelect}
/>
