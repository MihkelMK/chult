<script lang="ts">
	import { browser } from '$app/environment';
	import useImage from '$lib/hooks/useImage.svelte';
	import type {
		Hex,
		HexRendered,
		MapCanvasProps,
		MapCanvasWrapperProps,
		MapUrlsResponse
	} from '$lib/types';
	import type { Component } from 'svelte';
	import { SvelteSet } from 'svelte/reactivity';

	let {
		campaignSlug,
		variant = 'detail',
		isDM = false,
		previewMode = false,
		showAlwaysRevealed = false,
		tileTransparency = 0.75,
		hexesPerRow = 72,
		hexesPerCol = 86,
		xOffset = 70,
		yOffset = 58,
		cursorMode,
		zoom,
		showAnimations = true,
		showCoords = 'hover',
		initiallyRevealed = [],
		selectedTiles = [], // Add this line
		onHexRevealed = () => {},
		onHexHover = () => {},
		onMapLoad = () => {},
		onMapError = () => {},
		hasPoI = () => false,
		hasNotes = () => false,
		isPlayerPosition = () => false
	}: MapCanvasWrapperProps = $props();

	let canvasWidth = $state(0);
	let canvasHeight = $state(0);
	let mapUrls = $state<MapUrlsResponse | null>(null);
	let imageError = $state(false);
	let urlsLoading = $state(true);
	let hexGrid: Hex[] = $state([]);

	async function loadMapUrls() {
		try {
			const response = await fetch(`/api/campaigns/${campaignSlug}/map/urls`);

			if (!response.ok) {
				throw new Error('Failed to load map URLs');
			}

			const data = await response.json();
			mapUrls = data;
		} catch (error) {
			console.error('Failed to load map URLs:', error);
			imageError = true;
		} finally {
			urlsLoading = false;
		}
	}

	function generateHexGrid(): void {
		const newHexGrid: Hex[] = [];

		for (let row = 0; row < hexesPerCol; row++) {
			for (let col = 0; col < hexesPerRow; col++) {
				// Perfect tessellation for flat-top hexagons: odd columns offset vertically
				const offsetY = (col % 2) * (verticalSpacing * -0.5);
				// Apply the xOffset and yOffset to position the grid correctly
				const centerX = col * horizontalSpacing + hexRadius;
				const centerY = row * verticalSpacing + offsetY + hexHeight / 2;

				newHexGrid.push({
					id: `hex-${row}-${col}`,
					row,
					col,
					centerX,
					centerY
				});
			}
		}
		hexGrid = newHexGrid;
	}

	const MapCanvasLoader: Promise<Component<MapCanvasProps>> = browser
		? import('./MapCanvas.svelte').then((module) => module.default)
		: new Promise(() => {});

	// Get the correct URL based on variant
	let mapUrl = $derived.by(() => {
		if (!mapUrls) return '';

		return mapUrls.variants[variant];
	});

	let mapImageLoader = $derived(useImage(mapUrl));
	let { image, status } = $derived(mapImageLoader());

	// let hoveredHex: TileCoords | null = $state(null);
	// let hoverTimeout: ReturnType<typeof setTimeout> | undefined = $state();

	let revealedSet = $derived(new SvelteSet(initiallyRevealed.map((tile) => `${tile.x}-${tile.y}`)));
	let alwaysRevealedSet = $derived(
		new SvelteSet(
			initiallyRevealed.filter((tile) => tile.alwaysRevealed).map((tile) => `${tile.x}-${tile.y}`)
		)
	);
	let selectedSet = $derived(new SvelteSet(selectedTiles.map((tile) => `${tile.x}-${tile.y}`))); // Add this line

	// Calculate hex dimensions based on usable width and hexes per row
	let hexRadius: number = $derived(
		image ? (image.width - xOffset * 2) / (hexesPerRow * 1.5 + 0.5) : 0
	);
	let hexHeight: number = $derived(image ? (image.height - yOffset * 2) / hexesPerCol : 0);

	// Spacing for perfect tessellation of flat-top hexagons
	let horizontalSpacing: number = $derived(hexRadius * 1.5); // Hexes overlap by 1/4 of their width
	let verticalSpacing: number = $derived(hexHeight); // Full height spacing between rows

	let hexRenderData: HexRendered[] = $derived(
		hexGrid.map((hex) => {
			const key = `${hex.col}-${hex.row}`;
			const isRevealed = revealedSet.has(key);
			const isAlwaysRevealed = alwaysRevealedSet.has(key);
			const isSelected = selectedSet.has(key);

			return {
				...hex,
				fill: isSelected
					? 'rgb(249, 115, 22)'
					: isAlwaysRevealed
						? 'rgb(59, 130, 246)'
						: 'rgb(253, 250, 240',
				stroke: isSelected ? '#f97316' : isAlwaysRevealed ? '#3b82f6' : 'black',
				strokeWidth: isSelected ? '3' : isAlwaysRevealed || previewMode ? '2' : '1',
				strokeOpacity: isSelected ? '1' : isAlwaysRevealed ? '0.4' : '0.15',
				fillOpacity: previewMode
					? '0.25'
					: isSelected
						? '0.6'
						: isRevealed
							? '0'
							: isDM
								? tileTransparency
								: '1',
				shouldRender: !isAlwaysRevealed || (isDM && showAlwaysRevealed)
			};
		})
	);

	$effect(() => {
		loadMapUrls();
	});

	$effect(() => {
		if (status === 'loaded' && image) {
			generateHexGrid();
		}
	});
</script>

{#snippet placeholder()}
	<div class="p-4 h-screen max-w-screen min-w-screen">
		<!-- Loading overlay -->
		<div class="bg-gray-200 rounded-lg animate-pulse min-h-[80vh]">
			<div class="flex justify-center items-center h-full">
				<svg class="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
					/>
				</svg>
			</div>
		</div>
	</div>
{/snippet}

<svelte:window bind:innerWidth={canvasWidth} bind:innerHeight={canvasHeight} />

{#if urlsLoading}
	{@render placeholder()}
{:else if imageError || !mapUrls}
	<div class="bg-gray-200 rounded-lg animate-pulse min-h-[80vh]">
		<div class="flex flex-col justify-center items-center p-8 h-full">
			<svg
				class="mb-4 w-12 h-12 text-gray-400"
				fill="none"
				stroke="currentColor"
				viewBox="0 0 24 24"
			>
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="2"
					d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.664-.833-2.464 0L4.268 16.5c-.77.833.192 2.5 1.732 2.5z"
				/>
			</svg>
			<p class="text-center text-gray-500">
				{imageError ? 'Failed to load map' : 'No map uploaded'}
			</p>
		</div>
	</div>
{:else}
	{#if status !== 'loaded' || !image}
		{@render placeholder()}
	{/if}

	{#await MapCanvasLoader}
		{@render placeholder()}
	{:then MapCanvas}
		<MapCanvas
			{image}
			{zoom}
			{cursorMode}
			{hexRenderData}
			{xOffset}
			{yOffset}
			{hexesPerCol}
			{hexesPerRow}
			{showCoords}
			{showAnimations}
			{previewMode}
			{onHexRevealed}
			{onHexHover}
			{onMapLoad}
			{onMapError}
			{hasPoI}
			{hasNotes}
			{isPlayerPosition}
			{revealedSet}
			{hexRadius}
		/>
	{/await}
{/if}
