<script lang="ts">
	import Map from '$lib/components/Map.svelte';
	import TileDetails from '$lib/components/TileDetails.svelte';
	import type { PageData } from './$types';
	import type { TileCoords } from '$lib/types';

	interface Props {
		data: PageData;
	}

	let { data }: Props = $props();

	// Player state
	let currentPosition = $state<TileCoords | null>(
		data.revealedTiles.length > 0
			? { x: data.revealedTiles[0].x, y: data.revealedTiles[0].y }
			: null
	);

	let selectedTile = $state<TileCoords | null>(null);
	let revealedTiles = $state<TileCoords[]>(
		data.revealedTiles.map((tile) => ({ x: tile.x, y: tile.y }))
	);

	let navigationError = $state('');
	let showTileDetails = $state(false);

	// Get POIs and notes for a specific tile
	function getTileData(coords: TileCoords | null) {
		if (!coords) return { pois: [], notes: [] };

		const pois = data.pointsOfInterest.filter((poi) => poi.x === coords.x && poi.y === coords.y);
		const notes = data.tileNotes.filter((note) => note.x === coords.x && note.y === coords.y);

		return { pois, notes };
	}

	// Check if two tiles are adjacent
	function isAdjacent(from: TileCoords, to: TileCoords): boolean {
		const dx = Math.abs(from.x - to.x);
		const dy = Math.abs(from.y - to.y);

		// Hex grid adjacency rules
		if (dx === 0 && dy === 1) return true; // Vertical neighbors
		if (dy === 0 && dx === 1) return true; // Horizontal neighbors
		if (dx === 1 && dy === 1) {
			// Diagonal neighbors (hex grid specific)
			const evenCol = from.x % 2 === 0;
			if (evenCol) {
				return to.y === from.y - 1 || to.y === from.y + 1;
			} else {
				return to.y === from.y - 1 || to.y === from.y + 1;
			}
		}

		return false;
	}

	// Check if tile is revealed
	function isTileRevealed(coords: TileCoords): boolean {
		return revealedTiles.some((tile) => tile.x === coords.x && tile.y === coords.y);
	}

	// Handle tile click (navigation)
	function handleTileClick(event: { hex: any; index: number }) {
		const coords: TileCoords = { x: event.hex.col, y: event.hex.row };

		// Clear previous errors
		navigationError = '';

		// Can't navigate to already revealed tiles
		if (isTileRevealed(coords)) {
			selectedTile = coords;
			showTileDetails = true;
			return;
		}

		// Check if player can move to this tile
		if (!currentPosition) {
			// First move - allow any adjacent revealed tile
			const adjacentToRevealed = revealedTiles.some((revealed) => isAdjacent(coords, revealed));
			if (!adjacentToRevealed) {
				navigationError = 'You can only explore tiles adjacent to already discovered areas.';
				return;
			}
		} else {
			// Must be adjacent to current position
			if (!isAdjacent(currentPosition, coords)) {
				navigationError = 'You can only move to adjacent tiles.';
				return;
			}
		}

		// Valid move - reveal the tile
		navigateToTile(coords);
	}

	async function navigateToTile(coords: TileCoords) {
		try {
			const response = await fetch(`/api/campaigns/${data.campaign.slug}/player/navigate`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(coords)
			});

			if (!response.ok) {
				const error = await response.json();
				navigationError = error.message || 'Navigation failed';
				return;
			}

			// Success - update state
			currentPosition = coords;
			revealedTiles = [...revealedTiles, coords];
			selectedTile = coords;
			showTileDetails = true;
		} catch (error) {
			navigationError = 'Failed to navigate. Please try again.';
			console.error('Navigation error:', error);
		}
	}

	// Clear error after 5 seconds
	$effect(() => {
		if (navigationError) {
			const timer = setTimeout(() => {
				navigationError = '';
			}, 5000);

			return () => clearTimeout(timer);
		}
	});
</script>

<svelte:head>
	<title>Explore {data.campaign.name}</title>
</svelte:head>

<div class="space-y-6">
	<!-- Header -->
	<div class="flex justify-between items-center">
		<div>
			<h1 class="text-3xl font-bold text-gray-900">Interactive Map</h1>
			<p class="mt-1 text-gray-600">Click adjacent tiles to explore new areas</p>
		</div>

		<div class="flex items-center space-x-4">
			{#if currentPosition}
				<div class="py-1 px-3 text-sm font-medium text-green-800 bg-green-100 rounded-full">
					Position: {currentPosition.x + 1},{currentPosition.y + 1}
				</div>
			{/if}

			<a
				href="/{data.campaign.slug}"
				class="py-2 px-4 text-sm font-medium text-gray-700 bg-gray-100 rounded-md transition-colors hover:bg-gray-200"
			>
				← Back to Dashboard
			</a>
		</div>
	</div>

	<!-- Navigation Error -->
	{#if navigationError}
		<div class="p-4 text-red-700 bg-red-50 rounded-lg border border-red-200">
			<div class="flex items-center">
				<svg
					class="mr-2 w-5 h-5 text-red-500"
					fill="none"
					stroke="currentColor"
					viewBox="0 0 24 24"
				>
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
					/>
				</svg>
				<span>{navigationError}</span>
			</div>
		</div>
	{/if}

	<!-- Instructions -->
	<div class="p-4 text-blue-700 bg-blue-50 rounded-lg border border-blue-200">
		<div class="flex items-start">
			<svg
				class="mt-0.5 mr-2 w-5 h-5 text-blue-500"
				fill="none"
				stroke="currentColor"
				viewBox="0 0 24 24"
			>
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="2"
					d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
				/>
			</svg>
			<div class="text-sm">
				<p class="mb-1 font-medium">How to explore:</p>
				<ul class="space-y-1 text-blue-600">
					<li>• Click on tiles adjacent to your current position to move there</li>
					<li>• Light areas show explored territory</li>
					<li>• Dark areas are unexplored - click adjacent ones to reveal them</li>
					<li>• Click explored tiles to view details and add notes</li>
				</ul>
			</div>
		</div>
	</div>

	<!-- Map -->
	{#if data.hasMapImage}
		<div class="p-6 bg-white rounded-lg border border-gray-200 shadow-sm">
			<Map
				campaignSlug={data.campaign.slug}
				variant="responsive"
				initiallyRevealed={revealedTiles}
				showControls={false}
				showCoords="hover"
				onHexRevealed={handleTileClick}
			/>
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
			<h3 class="mb-2 text-lg font-medium text-gray-900">Map Not Available</h3>
			<p class="text-gray-600">The campaign map is being prepared by your DM.</p>
		</div>
	{/if}

	<!-- Stats -->
	<div class="grid grid-cols-1 gap-4 sm:grid-cols-3">
		<div class="p-4 text-center bg-white rounded-lg border border-gray-200 shadow-sm">
			<div class="text-2xl font-bold text-green-600">{revealedTiles.length}</div>
			<div class="text-sm text-gray-600">Tiles Explored</div>
		</div>
		<div class="p-4 text-center bg-white rounded-lg border border-gray-200 shadow-sm">
			<div class="text-2xl font-bold text-blue-600">{data.pointsOfInterest.length}</div>
			<div class="text-sm text-gray-600">Points Discovered</div>
		</div>
		<div class="p-4 text-center bg-white rounded-lg border border-gray-200 shadow-sm">
			<div class="text-2xl font-bold text-purple-600">{data.tileNotes.length}</div>
			<div class="text-sm text-gray-600">Notes Written</div>
		</div>
	</div>
</div>

<!-- Tile Details Modal -->
{#if showTileDetails && selectedTile}
	<TileDetails
		{selectedTile}
		tileData={getTileData(selectedTile)}
		campaignSlug={data.campaign.slug}
		onClose={() => {
			showTileDetails = false;
			selectedTile = null;
		}}
		onNoteAdded={() => {
			// Refresh data or update local state
			window.location.reload();
		}}
	/>
{/if}
