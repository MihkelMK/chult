<script lang="ts">
	import { browser } from '$app/environment';
	import useImage from '$lib/hooks/useImage.svelte';
	import type { Hex, MapCanvasProps, MapCanvasWrapperProps } from '$lib/types';
	import { type Component } from 'svelte';
	import { SvelteMap } from 'svelte/reactivity';
	import LoadingBar from '../general/LoadingBar.svelte';

	let {
		mapUrls,
		variant = 'detail',
		isDM = false,
		isDragging = $bindable(),
		previewMode = false,
		showAlwaysRevealed = false,
		showRevealed = false,
		showUnrevealed = true,
		tileTransparency = 1,
		canvasHeight,
		canvasWidth,
		hexesPerRow = 72,
		hexesPerCol = 86,
		xOffset = 70,
		yOffset = 58,
		imageHeight,
		imageWidth,
		activeTool,
		selectedTool,
		activeSelectMode,
		zoom,
		showAnimations = true,
		showCoords = 'hover',
		localState,
		selectedSet,
		onHexTriggered = () => {},
		onRightClick,
		onMapLoad = () => {},
		onMapError = () => {},
		hasPoI = () => false,
		hasNotes = () => false,
		showPaths = false,
		visiblePathSessions = new Set<number>()
	}: MapCanvasWrapperProps = $props();

	function generateHexGrid(
		hexesPerCol: number,
		hexesPerRow: number,
		horizontalSpacing: number,
		verticalSpacing: number
	): readonly Hex[] {
		const newHexGrid: Hex[] = [];
		// Flip col/row because the hex grid is rotated 90deg when rendered
		for (let row = 0; row < hexesPerCol; row++) {
			for (let col = 0; col < hexesPerRow; col++) {
				// Perfect tessellation for flat-top hexagons: odd columns offset vertically
				const offsetY = (col % 2) * (verticalSpacing * 0.5);
				// Apply the xOffset and yOffset to position the grid correctly
				const centerX = col * horizontalSpacing + hexRadius;
				const centerY = row * verticalSpacing + offsetY + hexHeight / 2;

				newHexGrid.push(
					Object.freeze({
						id: `${col}-${row}`,
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

	// Calculate hex dimensions based on usable width and hexes per row
	let hexRadius: number = $derived((variantWidth - xOffset * 2) / (hexesPerRow * 1.5 + 0.5));
	let hexHeight: number = $derived((variantHeight - yOffset * 2) / hexesPerCol);

	// Spacing for perfect tessellation of flat-top hexagons
	let horizontalSpacing: number = $derived(hexRadius * 1.5); // Hexes overlap by 1/4 of their width
	let verticalSpacing: number = $derived(hexHeight); // Full height spacing between rows

	let hexGrid = $derived(
		generateHexGrid(hexesPerCol, hexesPerRow, horizontalSpacing, verticalSpacing)
	);

	// Create a Map for O(1) lookups from coordinates to Hex objects
	let hexMap = $derived.by(() => {
		const map = new SvelteMap<string, Hex>();
		for (const hex of hexGrid) {
			map.set(`${hex.col}-${hex.row}`, hex);
		}
		return map;
	});

	// Optimized filtered tile arrays - O(n) where n = size of Set, not size of hexGrid
	// Track tilesVersion to ensure reactivity when Sets change
	let revealedTiles = $derived.by(() => {
		// eslint-disable-next-line @typescript-eslint/no-unused-expressions
		localState.tilesVersion; // Track version changes
		const tiles: Hex[] = [];
		for (const key of localState.revealedTilesSet) {
			const hex = hexMap.get(key);
			if (hex) tiles.push(hex);
		}
		return tiles;
	});

	let alwaysRevealedTiles = $derived.by(() => {
		// eslint-disable-next-line @typescript-eslint/no-unused-expressions
		localState.tilesVersion; // Track version changes
		const tiles: Hex[] = [];
		for (const key of localState.alwaysRevealedTilesSet) {
			const hex = hexMap.get(key);
			if (hex) tiles.push(hex);
		}
		return tiles;
	});

	let unrevealedTiles = $derived.by(() => {
		// eslint-disable-next-line @typescript-eslint/no-unused-expressions
		localState.tilesVersion; // Track version changes
		const tiles: Hex[] = [];
		for (const hex of hexGrid) {
			const key = `${hex.col}-${hex.row}`;
			if (!localState.revealedTilesSet.has(key) && !localState.alwaysRevealedTilesSet.has(key)) {
				tiles.push(hex);
			}
		}
		return tiles;
	});

	let partyTokenTile = $derived.by(() => {
		// eslint-disable-next-line @typescript-eslint/no-unused-expressions
		localState.tilesVersion; // Track version changes
		return (
			hexGrid.find(
				(hex) =>
					hex.col === localState.partyTokenPosition?.x &&
					hex.row === localState.partyTokenPosition.y
			) || null
		);
	});

	let selectedTiles = $derived.by(() => {
		const tiles: Hex[] = [];
		for (const key of selectedSet) {
			const hex = hexMap.get(key);
			if (hex) tiles.push(hex);
		}
		return tiles;
	});

	let adjacentTiles = $derived.by(() => {
		// eslint-disable-next-line @typescript-eslint/no-unused-expressions
		localState.tilesVersion; // Track version changes
		const tiles: Hex[] = [];

		if (localState.partyTokenPosition) {
			const { x: partyX, y: partyY } = localState.partyTokenPosition;
			const isOddCol = partyX % 2 === 1;
			const adjacentOffsets = isOddCol
				? [
						[0, -1],
						[1, 0],
						[1, 1],
						[0, 1],
						[-1, 1],
						[-1, 0]
					] // Odd column
				: [
						[0, -1],
						[1, -1],
						[1, 0],
						[0, 1],
						[-1, 0],
						[-1, -1]
					]; // Even column

			adjacentOffsets.forEach(([dx, dy]) => {
				const x = partyX + dx;
				const y = partyY + dy;
				const key = `${x}-${y}`;
				const hex = hexMap.get(key);
				if (hex) tiles.push(hex);
			});
		}
		return tiles;
	});
</script>

{#await MapCanvasLoader}
	<LoadingBar />
{:then MapCanvas}
	{#if status !== 'loaded' || !image}
		<LoadingBar />
	{/if}
	<MapCanvas
		bind:isDragging
		{canvasWidth}
		{canvasHeight}
		{revealedTiles}
		{alwaysRevealedTiles}
		{unrevealedTiles}
		{selectedTiles}
		{adjacentTiles}
		{partyTokenTile}
		{image}
		{zoom}
		{activeTool}
		{selectedTool}
		{activeSelectMode}
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
		{onHexTriggered}
		{onRightClick}
		{onMapLoad}
		{onMapError}
		{hasPoI}
		{hasNotes}
		{hexRadius}
		{showPaths}
		{visiblePathSessions}
		sessions={localState.gameSessions}
		pathsMap={localState.pathsMap}
		{hexGrid}
	/>
{/await}
