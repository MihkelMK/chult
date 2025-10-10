<script lang="ts">
	import { browser } from '$app/environment';
	import useImage from '$lib/hooks/useImage.svelte';
	import type { Hex, MapCanvasProps, MapCanvasWrapperProps } from '$lib/types';
	import { untrack, type Component } from 'svelte';
	import { SvelteSet } from 'svelte/reactivity';
	import LoadingBar from './LoadingBar.svelte';

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
		imageHeight,
		imageWidth,
		cursorMode,
		zoom,
		showAnimations = true,
		showCoords = 'hover',
		campaignState,
		selectedTiles = [],
		onHexRevealed = () => {},
		onHexHover = () => {},
		onMapLoad = () => {},
		onMapError = () => {},
		hasPoI = () => false,
		hasNotes = () => false,
		isPlayerPosition = () => false
	}: MapCanvasWrapperProps = $props();

	function generateHexGrid(
		hexesPerCol: number,
		hexesPerRow: number,
		horizontalSpacing: number,
		verticalSpacing: number
	): readonly Hex[] {
		const newHexGrid: Hex[] = [];
		for (let row = 0; row < hexesPerCol; row++) {
			for (let col = 0; col < hexesPerRow; col++) {
				// Perfect tessellation for flat-top hexagons: odd columns offset vertically
				const offsetY = (col % 2) * (verticalSpacing * -0.5);
				// Apply the xOffset and yOffset to position the grid correctly
				const centerX = col * horizontalSpacing + hexRadius;
				const centerY = row * verticalSpacing + offsetY + hexHeight / 2;

				newHexGrid.push(
					Object.freeze({
						id: `hex-${row}-${col}`,
						row,
						col,
						centerX,
						centerY
					})
				);
			}
		}
		return Object.freeze(newHexGrid);
	}

	const MapCanvasLoader: Promise<Component<MapCanvasProps>> = browser
		? import('./MapCanvas.svelte').then((module) => module.default)
		: new Promise(() => {});

	// Get the correct URL based on variant
	let { url: mapUrl, width: variantWidth } = $derived(mapUrls.variants[variant]);
	let variantScale = $derived(imageWidth / variantWidth);
	let variantHeight = $derived(imageHeight / variantScale);

	let mapImageLoader = $derived(useImage(mapUrl));
	let { image, status } = $derived(mapImageLoader());

	// svelte-ignore non_reactive_update
	let selectedSet = new SvelteSet<string>();

	// Calculate hex dimensions based on usable width and hexes per row
	let hexRadius: number = $derived((variantWidth - xOffset * 2) / (hexesPerRow * 1.5 + 0.5));
	let hexHeight: number = $derived((variantHeight - yOffset * 2) / hexesPerCol);

	// Spacing for perfect tessellation of flat-top hexagons
	let horizontalSpacing: number = $derived(hexRadius * 1.5); // Hexes overlap by 1/4 of their width
	let verticalSpacing: number = $derived(hexHeight); // Full height spacing between rows

	let hexGrid = $derived(
		generateHexGrid(hexesPerCol, hexesPerRow, horizontalSpacing, verticalSpacing)
	);

	// Sync selectedSet incrementally (only UI-specific Set we manage)
	$effect(() => {
		const newKeys = new Set(selectedTiles.map((t) => `${t.x}-${t.y}`));

		untrack(() => {
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

		selectedSet = selectedSet;
	});
</script>

{#await MapCanvasLoader}
	<LoadingBar />
{:then MapCanvas}
	{#if status !== 'loaded' || !image}
		<LoadingBar />
	{/if}
	<MapCanvas
		{hexGrid}
		revealedSet={campaignState.revealedTilesSet}
		alwaysRevealedSet={campaignState.alwaysRevealedTilesSet}
		{selectedSet}
		{image}
		{zoom}
		{cursorMode}
		{xOffset}
		{yOffset}
		imageHeight={variantHeight}
		imageWidth={variantWidth}
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
