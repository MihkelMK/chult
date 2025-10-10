<script lang="ts">
	import { browser } from '$app/environment';
	import useImage from '$lib/hooks/useImage.svelte';
	import type { Hex, MapCanvasProps, MapCanvasWrapperProps } from '$lib/types';
	import { LoaderCircleIcon } from '@lucide/svelte';
	import type { Component } from 'svelte';
	import { SvelteSet } from 'svelte/reactivity';

	let {
		mapUrls,
		variant = 'detail',
		isDM = false,
		previewMode = false,
		showAlwaysRevealed = false,
		showRevealed = false,
		showUnrevealed = true,
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
	let hexGrid: Hex[] = $state([]);

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
	let mapUrl = $derived(mapUrls.variants[variant]);

	let mapImageLoader = $derived(useImage(mapUrl));
	let { image, status } = $derived(mapImageLoader());

	// let hoveredHex: TileCoords | null = $state(null);
	// let hoverTimeout: ReturnType<typeof setTimeout> | undefined = $state();

	let revealedSet = new SvelteSet<string>();
	let alwaysRevealedSet = new SvelteSet<string>();
	let selectedSet = new SvelteSet<string>();

	// Calculate hex dimensions based on usable width and hexes per row
	let hexRadius: number = $derived(
		image ? (image.width - xOffset * 2) / (hexesPerRow * 1.5 + 0.5) : 0
	);
	let hexHeight: number = $derived(image ? (image.height - yOffset * 2) / hexesPerCol : 0);

	// Spacing for perfect tessellation of flat-top hexagons
	let horizontalSpacing: number = $derived(hexRadius * 1.5); // Hexes overlap by 1/4 of their width
	let verticalSpacing: number = $derived(hexHeight); // Full height spacing between rows

	$effect(() => {
		if (status === 'loaded' && image) {
			generateHexGrid();
		}
	});

	// Sync revealedSet incrementally
	$effect(() => {
		const newKeys = new Set(
			initiallyRevealed.filter((t) => !t.alwaysRevealed).map((t) => `${t.x}-${t.y}`)
		);

		// Add new tiles
		newKeys.forEach((key) => {
			if (!revealedSet.has(key)) {
				revealedSet.add(key);
			}
		});

		// Remove tiles no longer revealed
		const toRemove: string[] = [];
		revealedSet.forEach((key) => {
			if (!newKeys.has(key)) {
				toRemove.push(key);
			}
		});
		toRemove.forEach((key) => revealedSet.delete(key));
	});

	// Sync alwaysRevealedSet incrementally
	$effect(() => {
		const newKeys = new Set(
			initiallyRevealed.filter((t) => t.alwaysRevealed).map((t) => `${t.x}-${t.y}`)
		);

		newKeys.forEach((key) => {
			if (!alwaysRevealedSet.has(key)) {
				alwaysRevealedSet.add(key);
			}
		});

		const toRemove: string[] = [];
		alwaysRevealedSet.forEach((key) => {
			if (!newKeys.has(key)) {
				toRemove.push(key);
			}
		});
		toRemove.forEach((key) => alwaysRevealedSet.delete(key));
	});

	// Sync selectedSet incrementally
	$effect(() => {
		const newKeys = new Set(selectedTiles.map((t) => `${t.x}-${t.y}`));

		newKeys.forEach((key) => {
			if (!selectedSet.has(key)) {
				selectedSet.add(key);
			}
		});

		const toRemove: string[] = [];
		selectedSet.forEach((key) => {
			if (!newKeys.has(key)) {
				toRemove.push(key);
			}
		});
		toRemove.forEach((key) => selectedSet.delete(key));
	});
</script>

<!-- Loading overlay -->
{#snippet placeholder()}
	<div class="flex justify-center items-center p-4 h-screen bg-gray-200 rounded-lg animate-pulse">
		<LoaderCircleIcon class="w-8 h-8 animate-spin" />
	</div>
{/snippet}

<svelte:window bind:innerWidth={canvasWidth} bind:innerHeight={canvasHeight} />

{#if status !== 'loaded' || !image}
	{@render placeholder()}
{/if}

{#await MapCanvasLoader}
	{@render placeholder()}
{:then MapCanvas}
	<MapCanvas
		{hexGrid}
		{revealedSet}
		{selectedSet}
		{alwaysRevealedSet}
		{image}
		{zoom}
		{cursorMode}
		{xOffset}
		{yOffset}
		{hexesPerCol}
		{hexesPerRow}
		{showCoords}
		{showAnimations}
		{showAlwaysRevealed}
		{showUnrevealed}
		{showRevealed}
		{previewMode}
		{isDM}
		{tileTransparency}
		{onHexRevealed}
		{onHexHover}
		{onMapLoad}
		{onMapError}
		{hasPoI}
		{hasNotes}
		{isPlayerPosition}
		{hexRadius}
	/>
{/await}
