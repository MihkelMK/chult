<script lang="ts">
	import MapView from '$lib/components/MapView.svelte';
	import type { PageData } from './$types';
	import {
		createPlayerTileManager,
		type PlayerTileState
	} from '$lib/stores/playerTileManager.svelte';
	import { createTileManager, type TileState } from '$lib/stores/tileManager.svelte';
	import { onDestroy } from 'svelte';
	import { getCampaignState } from '$lib/contexts/campaignContext';
	import type { PlayerCampaignState } from '$lib/stores/playerCampaignState.svelte';
	import type { DMCampaignState } from '$lib/stores/dmCampaignState.svelte';

	interface Props {
		data: PageData;
	}

	let { data }: Props = $props();

	// Determine effective role from session
	const effectiveRole = data.session ? data.session.viewAs || data.session.role : 'player';
	const isDM = effectiveRole === 'dm';

	const campaignState = getCampaignState();

	// Create appropriate tile manager based on effective role
	const playerTileManager = !isDM
		? createPlayerTileManager(
				data.campaign.slug,
				data.revealedTiles.map((tile) => ({ x: tile.x, y: tile.y })),
				data.revealedTiles.length > 0
					? { x: data.revealedTiles[0].x, y: data.revealedTiles[0].y }
					: null,
				campaignState as PlayerCampaignState
			)
		: null;

	const dmTileManager = isDM
		? createTileManager(
				data.campaign.slug,
				data.revealedTiles, // Pass full revealed tile objects including alwaysRevealed
				campaignState as DMCampaignState
			)
		: null;

	// State for player mode
	let playerTileState = $state<PlayerTileState>({
		revealed: data.revealedTiles.map((tile) => ({ x: tile.x, y: tile.y })),
		pending: null,
		error: null,
		currentPosition: null
	});

	// State for DM mode
	let dmTileState = $state<TileState>({ revealed: [], pending: [], errors: [] });

	// Subscribe to the appropriate manager
	const unsubscribe = isDM
		? dmTileManager?.subscribe((state) => {
				dmTileState = state;
			})
		: playerTileManager?.subscribe((state) => {
				playerTileState = state;
			});

	onDestroy(() => unsubscribe?.());

	// Remove liveRevealedTiles - now using tileManager as single source of truth

	// function onTileAction(coords: TileCoords) {
	// 	if (isDM && dmTileManager) {
	// 		// DM: Single tile reveal/hide toggle
	// 		const isRevealed = dmTileManager.isRevealed(coords, dmTileState);
	// 		if (isRevealed) {
	// 			dmTileManager.hideTile(coords);
	// 		} else {
	// 			dmTileManager.revealTile(coords);
	// 		}
	// 	} else if (playerTileManager) {
	// 		// Player navigation
	// 		playerTileManager.navigate(coords);
	// 	}
	// }

	// Clear error after 5 seconds (player mode)
	$effect(() => {
		if (!isDM && playerTileState.error) {
			const timer = setTimeout(() => {
				playerTileManager?.clearError();
			}, 5000);

			return () => clearTimeout(timer);
		}
	});
</script>

<svelte:head>
	<title>{isDM ? 'Interactive Map' : 'Explore'} - {data.campaign.name}</title>
</svelte:head>

<MapView
	{data}
	mode={isDM ? 'dm' : 'player'}
	tileState={isDM ? dmTileState : playerTileState}
	tileManager={isDM ? dmTileManager : playerTileManager}
/>
