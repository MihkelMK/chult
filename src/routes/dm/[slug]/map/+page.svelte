<script lang="ts">
	import Map from '$lib/components/Map.svelte';
	import DMTileDetails from '$lib/components/DMTileDetails.svelte';
	import type { PageData } from './$types';
	import type { HexRevealedEvent, TileCoords, PointOfInterestResponse } from '$lib/types';
	import { invalidate } from '$app/navigation';
	import { createTileManager, type TileState } from '$lib/stores/tileManager';
	import { onDestroy } from 'svelte';

	interface Props {
		data: PageData;
	}

	let { data }: Props = $props();

	const tileManager = createTileManager(
		data.session.campaignSlug,
		data.revealedTiles.map((tile) => ({ x: tile.x, y: tile.y }))
	);

	let tileState = $state<TileState>({ revealed: [], pending: [], errors: [] });
	const unsubscribe = tileManager.subscribe((state) => {
		tileState = state;
	});

	onDestroy(unsubscribe);

	let selectedTiles = $state<TileCoords[]>([]);
	let selectedTile = $state<TileCoords | null>(null);
	let isSelecting = $state(false);
	let showTileDetails = $state(false);

	let currentRevealedTiles = $derived(tileManager.getRevealedTiles(tileState));
	let hasPendingOperations = $derived(tileState.pending.length > 0);
	let hasErrors = $derived(tileState.errors.length > 0);

	// Get tile data for details modal
	function getTileData(coords: TileCoords | null) {
		if (!coords) return { pois: [], notes: [] };

		const pois = (data.pointsOfInterest as PointOfInterestResponse[]).filter(
			(poi) => poi.x === coords.x && poi.y === coords.y
		);
		const notes = data.tileNotes.filter((note) => note.x === coords.x && note.y === coords.y);

		return { pois, notes };
	}

	function handleHexClick(event: HexRevealedEvent) {
		const coords: TileCoords = { x: event.hex.col, y: event.hex.row };

		if (isSelecting) {
			// Multi-select mode
			const index = selectedTiles.findIndex((tile) => tile.x === coords.x && tile.y === coords.y);
			if (index >= 0) {
				selectedTiles = selectedTiles.filter((_, i) => i !== index);
			} else {
				selectedTiles = [...selectedTiles, coords];
			}
		} else {
			// Single tile selection - show details
			selectedTile = coords;
			showTileDetails = true;
		}
	}

	function handleHexRevealed(event: HexRevealedEvent) {
		const coords: TileCoords = { x: event.hex.col, y: event.hex.row };

		tileManager.revealTile(coords);
	}

	function revealSelectedTiles() {
		if (selectedTiles.length > 0) {
			tileManager.revealTiles(selectedTiles);
			selectedTiles = [];
			isSelecting = false;
		}
	}

	function hideSelectedTiles() {
		if (selectedTiles.length > 0) {
			tileManager.hideTiles(selectedTiles);
			selectedTiles = [];
			isSelecting = false;
		}
	}

	function handleTileRevealed(coords: TileCoords) {
		tileManager.revealTile(coords);
	}

	function handleTileHidden(coords: TileCoords) {
		tileManager.hideTile(coords);
	}

	function flushPendingOperations() {
		tileManager.flush();
	}

	function selectAllRevealed() {
		selectedTiles = [...currentRevealedTiles];
	}

	function handleTileUpdated() {
		// Refresh the page data
		invalidate('campaign:data');
	}

	$inspect(tileManager.getRevealedTiles(tileState));
</script>

<svelte:head>
	<title>Interactive Map - {data.campaign.name}</title>
</svelte:head>

<div class="space-y-6">
	<!-- Header -->
	<div class="flex justify-between items-center">
		<div>
			<h1 class="text-2xl font-bold text-gray-900">Interactive Map</h1>
			<p class="text-sm text-gray-600">
				Click tiles to manage content • Changes are saved automatically
				{#if hasPendingOperations}
					<span
						class="inline-flex items-center py-0.5 px-2 ml-2 text-xs font-medium text-yellow-800 bg-yellow-100 rounded-full"
					>
						<svg
							class="mr-1 w-3 h-3 animate-spin"
							fill="none"
							stroke="currentColor"
							viewBox="0 0 24 24"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
							/>
						</svg>
						{tileState.pending.length} pending
					</span>
				{/if}
			</p>
		</div>

		<div class="flex items-center space-x-3">
			{#if hasPendingOperations}
				<button
					onclick={flushPendingOperations}
					class="py-1 px-3 text-xs font-medium text-yellow-800 bg-yellow-100 rounded-full transition-colors hover:bg-yellow-200"
				>
					Save Now
				</button>
			{/if}

			<a
				href="/{data.session.campaignSlug}/map"
				target="_blank"
				class="py-2 px-4 text-sm font-medium text-blue-600 rounded-md border border-blue-300 transition-colors hover:bg-blue-50"
			>
				Player View →
			</a>

			<a
				href="/dm/{data.session.campaignSlug}"
				class="py-2 px-4 text-sm font-medium text-gray-700 bg-gray-100 rounded-md transition-colors hover:bg-gray-200"
			>
				← Back to Dashboard
			</a>
		</div>
	</div>

	<!-- Error Messages -->
	{#if hasErrors}
		<div class="p-4 bg-red-50 rounded-lg border border-red-200">
			<div class="flex justify-between items-start">
				<div>
					<h3 class="text-sm font-medium text-red-800">Operation Failed</h3>
					<div class="mt-2 text-sm text-red-700">
						{#each tileState.errors as error (error.coords)}
							<p>{error.message}</p>
						{/each}
					</div>
				</div>
				<!-- svelte-ignore a11y_consider_explicit_label -->
				<button onclick={tileManager.clearErrors} class="text-red-400 hover:text-red-600">
					<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M6 18L18 6M6 6l12 12"
						/>
					</svg>
				</button>
			</div>
		</div>
	{/if}

	<!-- Controls -->
	<div class="p-6 bg-white rounded-lg border border-gray-200 shadow-sm">
		<h2 class="mb-4 text-lg font-medium text-gray-900">DM Controls</h2>

		<div class="flex flex-wrap gap-3 mb-4">
			<button
				onclick={() => {
					isSelecting = !isSelecting;
					if (!isSelecting) selectedTiles = [];
				}}
				class="rounded-md px-4 py-2 text-sm font-medium transition-colors {isSelecting
					? 'bg-blue-600 text-white hover:bg-blue-700'
					: 'bg-gray-100 text-gray-700 hover:bg-gray-200'}"
			>
				{isSelecting ? 'Stop Selecting' : 'Multi-Select Mode'}
			</button>

			{#if isSelecting}
				<button
					onclick={selectAllRevealed}
					class="py-2 px-4 text-sm font-medium text-gray-700 bg-gray-100 rounded-md transition-colors hover:bg-gray-200"
				>
					Select All Revealed
				</button>

				{#if selectedTiles.length > 0}
					<button
						onclick={revealSelectedTiles}
						class="py-2 px-4 text-sm font-medium text-white bg-green-600 rounded-md transition-colors hover:bg-green-700"
					>
						Reveal {selectedTiles.length} Selected
					</button>

					<button
						onclick={hideSelectedTiles}
						class="py-2 px-4 text-sm font-medium text-white bg-red-600 rounded-md transition-colors hover:bg-red-700"
					>
						Hide {selectedTiles.length} Selected
					</button>

					<button
						onclick={() => (selectedTiles = [])}
						class="py-2 px-4 text-sm font-medium text-gray-700 bg-gray-100 rounded-md transition-colors hover:bg-gray-200"
					>
						Clear Selection ({selectedTiles.length})
					</button>
				{/if}
			{/if}
		</div>

		<div class="text-sm text-gray-600">
			{#if isSelecting}
				<p class="mb-2">
					<strong>Multi-Select Mode:</strong> Click tiles to select them for batch operations.
				</p>
				{#if selectedTiles.length > 0}
					<p>Selected: {selectedTiles.length} tiles</p>
				{/if}
			{:else}
				<p>
					<strong>Single-Click Mode:</strong> Click any tile to view details and manage content.
				</p>
			{/if}
		</div>

		<div
			class="flex items-center pt-4 mt-4 space-x-6 text-sm text-gray-600 border-t border-gray-200"
		>
			<span>Revealed: <strong>{currentRevealedTiles.length}</strong> tiles</span>
			<span>POIs: <strong>{data.pointsOfInterest.length}</strong></span>
			<span>Notes: <strong>{data.tileNotes.length}</strong></span>
			{#if hasPendingOperations}
				<span class="text-yellow-600">
					<strong>{tileState.pending.length}</strong> changes pending
				</span>
			{/if}
		</div>
	</div>

	<!-- Map -->
	{#if data.hasMapImage}
		<div class="p-6 bg-white rounded-lg border border-gray-200 shadow-sm">
			<Map
				campaignSlug={data.session.campaignSlug}
				variant="hexGrid"
				initiallyRevealed={currentRevealedTiles}
				selectedTiles={selectedTiles}
				showControls={true}
				showCoords="always"
				onHexRevealed={isSelecting ? handleHexClick : handleHexRevealed}
			/>

			<!-- Map Legend -->
			<div class="pt-4 mt-4 border-t border-gray-200">
				<div class="flex flex-wrap gap-6 items-center text-xs text-gray-600">
					<div class="flex items-center">
						<div class="mr-2 w-4 h-4 bg-gray-200 rounded opacity-60"></div>
						<span>Revealed to players</span>
					</div>
					<div class="flex items-center">
						<div class="mr-2 w-4 h-4 bg-yellow-200 rounded opacity-80 animate-pulse"></div>
						<span>Pending database save</span>
					</div>
					<div class="flex items-center">
						<div class="mr-2 w-4 h-4 bg-blue-100 rounded border border-blue-300"></div>
						<span>Has POIs</span>
					</div>
					<div class="flex items-center">
						<div class="mr-2 w-4 h-4 bg-purple-100 rounded border border-purple-300"></div>
						<span>Has player notes</span>
					</div>
					{#if isSelecting}
						<div class="flex items-center">
							<div class="mr-2 w-4 h-4 bg-orange-200 rounded border-2 border-orange-400"></div>
							<span>Selected for batch operation</span>
						</div>
					{/if}
				</div>
			</div>
		</div>
	{:else}
		<div class="p-12 text-center bg-white rounded-lg border border-gray-200 shadow-sm">
			<svg
				class="mx-auto mb-4 w-16 h-16 text-gray-400"
				fill="none"
				stroke="currentColor"
				viewBox="0 0 24 24"
			>
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="2"
					d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-1.447-.894L15 4m0 13V4m0 0L9 7"
				/>
			</svg>
			<h3 class="mb-2 text-lg font-medium text-gray-900">No Map Uploaded</h3>
			<p class="mb-6 text-gray-600">
				Upload a campaign map to start using the interactive features.
			</p>
			<a
				href="/dm/{data.session.campaignSlug}"
				class="py-3 px-6 font-medium text-white bg-blue-600 rounded-lg transition-colors hover:bg-blue-700"
			>
				Upload Map Now
			</a>
		</div>
	{/if}
</div>

<!-- Tile Details Modal -->
{#if showTileDetails && selectedTile}
	<DMTileDetails
		{selectedTile}
		tileData={getTileData(selectedTile)}
		campaignSlug={data.session.campaignSlug}
		isRevealed={tileManager.isRevealed(selectedTile, tileState)}
		onClose={() => {
			showTileDetails = false;
			selectedTile = null;
		}}
		onTileUpdated={handleTileUpdated}
		onTileRevealed={handleTileRevealed}
		onTileHidden={handleTileHidden}
	/>
{/if}
