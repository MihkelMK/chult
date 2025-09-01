<script lang="ts">
	import type { TileCoords, Hex, HexRevealedEvent } from '$lib/types';
	import type { RevealedTileResponse } from '$lib/types/database';
	import { onMount } from 'svelte';
	import { SvelteSet } from 'svelte/reactivity';
	import MapImage from './MapImage.svelte';
	import panzoom, { type PanZoom } from 'panzoom';
	import type { Attachment } from 'svelte/attachments';

	interface HexInteractable extends Hex {
		points: string;
	}

	interface Props {
		campaignSlug: string;
		variant?:
			| 'thumbnail'
			| 'small'
			| 'medium'
			| 'large'
			| 'hexGrid'
			| 'overview'
			| 'detail'
			| 'responsive';
		isDM?: boolean;
		isSelecting?: boolean;
		showAlwaysRevealed?: boolean;
		tileTransparency?: number;
		hexesPerRow?: number; // Number of hexagons per row on the actual map
		hexesPerCol?: number; // Number of hexagons per column on the actual map
		xOffset?: number; // Horizontal offset in pixels from left edge to where grid starts
		yOffset?: number; // Vertical offset in pixels from top edge to where grid starts
		initiallyRevealed?: RevealedTileResponse[];
		selectedTiles?: TileCoords[]; // Add this line
		showCoords?: 'never' | 'always' | 'hover';
		showAnimations?: boolean;
		onHexRevealed?: (event: HexRevealedEvent) => void;
		onHexHover?: (coords: TileCoords | null) => void;
		onMapLoad?: (dimensions: { width: number; height: number }) => void;
		onMapError?: () => void;
		hasPoI?: (coords: TileCoords) => boolean;
		hasNotes?: (coords: TileCoords) => boolean;
		isPlayerPosition?: (coords: TileCoords) => boolean;
		cursorMode?: 'interact' | 'pan' | 'select' | 'paint';
		zoom: number;
	}

	let {
		campaignSlug,
		variant = 'hexGrid',
		isDM = false,
		isSelecting = false,
		showAlwaysRevealed = false,
		tileTransparency = 0.75,
		hexesPerRow = 72,
		hexesPerCol = 86,
		xOffset = 70,
		yOffset = 58,
		initiallyRevealed = [],
		selectedTiles = [], // Add this line
		showCoords = 'hover',
		showAnimations = true,
		onHexRevealed = () => {},
		onHexHover = () => {},
		onMapLoad = () => {},
		onMapError = () => {},
		hasPoI = () => false,
		hasNotes = () => false,
		isPlayerPosition = () => false,
		cursorMode,
		zoom
	}: Props = $props();

	let hexGrid: HexInteractable[] = $state([]);
	let imageNaturalDimensions = $state({ width: 0, height: 0 });
	let mounted: boolean = $state(false);
	let mapLoaded = $state(false);

	let revealedSet = $derived(new SvelteSet(initiallyRevealed.map((tile) => `${tile.x}-${tile.y}`)));
	let alwaysRevealedSet = $derived(
		new SvelteSet(
			initiallyRevealed.filter((tile) => tile.alwaysRevealed).map((tile) => `${tile.x}-${tile.y}`)
		)
	);
	let selectedSet = $derived(new SvelteSet(selectedTiles.map((tile) => `${tile.x}-${tile.y}`))); // Add this line

	// Calculate the usable width (image width minus the offset margins)
	let usableWidth: number = $derived(imageNaturalDimensions.width - xOffset * 2);
	let usableHeight: number = $derived(imageNaturalDimensions.height - yOffset * 2);

	// Calculate hex dimensions based on usable width and hexes per row
	let hexRadius: number = $derived(usableWidth / (hexesPerRow * 1.5 + 0.5));
	let hexHeight: number = $derived(usableHeight / hexesPerCol);

	// Spacing for perfect tessellation of flat-top hexagons
	let horizontalSpacing: number = $derived(hexRadius * 1.5); // Hexes overlap by 1/4 of their width
	let verticalSpacing: number = $derived(hexHeight); // Full height spacing between rows

	// Calculate grid dimensions based on usable area
	let cols: number = $derived(Math.ceil(usableWidth / horizontalSpacing));
	let rows: number = $derived(Math.ceil(usableHeight / verticalSpacing));

	// Use the natural image dimensions for the container
	let containerWidth: number = $derived(imageNaturalDimensions.width);
	let containerHeight: number = $derived(imageNaturalDimensions.height);

	let panEl: PanZoom | null = $state(null);
	// Generate hex grid when dimensions change
	$effect(() => {
		if (mounted && mapLoaded && imageNaturalDimensions.width > 0) {
			generateHexGrid();
		}
	});

	onMount(() => {
		mounted = true;
	});

	function handleMapError() {
		console.error('Failed to load campaign map');
		onMapError?.();
	}

	function handleMapLoad(imageElement: HTMLImageElement) {
		if (imageElement) {
			// Get the natural (original) dimensions of the image
			const dimensions = {
				width: imageElement.naturalWidth,
				height: imageElement.naturalHeight
			};

			imageNaturalDimensions = dimensions;
			mapLoaded = true;
			onMapLoad?.(dimensions);
		}
	}

	function generateHexGrid(): void {
		const newHexGrid: HexInteractable[] = [];

		for (let row = 0; row < rows; row++) {
			for (let col = 0; col < cols; col++) {
				// Perfect tessellation for flat-top hexagons: odd columns offset vertically
				const offsetY = (col % 2) * (verticalSpacing * -0.5);
				// Apply the xOffset and yOffset to position the grid correctly
				const centerX = col * horizontalSpacing + hexRadius + xOffset;
				const centerY = row * verticalSpacing + offsetY + hexHeight / 2 + yOffset;

				const points = generateFlatTopHexPoints(centerX, centerY, hexRadius);
				newHexGrid.push({
					id: `hex-${row}-${col}`,
					row,
					col,
					centerX,
					centerY,
					points
				});
			}
		}
		hexGrid = newHexGrid;
	}

	function generateFlatTopHexPoints(centerX: number, centerY: number, radius: number): string {
		const points: number[][] = [];

		// Generate 6 vertices for flat-top hexagon
		for (let i = 0; i < 6; i++) {
			const angle = (Math.PI / 3) * i; // 60 degrees between vertices
			const x = centerX + radius * Math.cos(angle);
			const y = centerY + radius * Math.sin(angle);
			points.push([x, y]);
		}

		// Keep precise coordinates
		return points.map((point) => `${point[0]},${point[1]}`).join(' ');
	}

	const panzoomAttach: Attachment = (element) => {
		panEl = panzoom(element as HTMLElement, {
			transformOrigin: { x: 0.5, y: 0.5 },
			maxZoom: 4,
			minZoom: 1,
			smoothScroll: false,
			disableKeyboardInteraction: true,
			zoomDoubleClickSpeed: 1,
			bounds: true,
			beforeMouseDown() {
				return cursorMode !== 'pan';
			},
			beforeWheel() {
				return true;
			}
		});

		return () => {
			panEl?.dispose();
		};
	};

	$effect(() => {
		if (zoom === 1) {
			panEl?.zoomAbs(0, 0, 1);
			panEl?.moveTo(0, 0);
		} else {
			panEl?.zoomAbs(0, 0, zoom);
		}
	});
</script>

{#snippet label(hex: Hex | HexInteractable, showWhen: 'never' | 'hover' | 'always')}
	{#if showWhen !== 'never'}
		<text
			x={hex.centerX + (hex.col === cols - 1 ? 2 : 0)}
			y={hex.centerY + 2}
			text-anchor={hex.col === cols - 1 ? 'end' : 'middle'}
			font-size="6"
			fill="rgba(0, 0, 0, 0.75)"
			stroke="rgba(253, 250, 240)"
			stroke-width="1"
			paint-order="stroke fill"
			class="select-none {showWhen === 'hover'
				? '[fill-opacity:0] [stroke-opacity:0]'
				: revealedSet.has(`${hex.col}-${hex.row}`)
					? '[fill-opacity:0.5] [stroke-opacity:0.25]'
					: ''} group-hover:[fill-opacity:1] group-hover:[stroke-opacity:1]"
			text-rendering="geometricPrecision"
			style={showAnimations ? 'transition: stroke-opacity 300ms, fill-opacity 300ms;' : ''}
			pointer-events="none"
		>
			{(hex.col + 1).toString().padStart(2, '0')}{hex.row.toString().padStart(2, '0')}
		</text>
	{/if}
{/snippet}

{#snippet indicators(hex: Hex | HexInteractable)}
	{@const coords = { x: hex.col, y: hex.row }}
	{@const centerX = hex.centerX}
	{@const centerY = hex.centerY}
	{@const hasPoIMarker = hasPoI(coords)}
	{@const hasNotesMarker = hasNotes(coords)}
	{@const isPlayerHere = isPlayerPosition(coords)}

	<!-- Player position indicator (highest priority) -->
	{#if isPlayerHere}
		<circle
			cx={centerX}
			cy={centerY - 8}
			r="4"
			fill="#22c55e"
			stroke="white"
			stroke-width="1.5"
			class="drop-shadow-sm"
		/>
		<circle cx={centerX} cy={centerY - 8} r="2" fill="white" class="animate-pulse" />
	{/if}

	<!-- POI indicator (red pin, top right) -->
	{#if hasPoIMarker}
		<g transform="translate({centerX + 8}, {centerY - 8})">
			<circle r="3" fill="#ef4444" stroke="white" stroke-width="1" />
			<circle r="1.5" fill="white" />
		</g>
	{/if}

	<!-- Notes indicator (blue note, top left) -->
	{#if hasNotesMarker}
		<g transform="translate({centerX - 8}, {centerY - 8})">
			<rect
				x="-2"
				y="-2"
				width="4"
				height="4"
				rx="0.5"
				fill="#3b82f6"
				stroke="white"
				stroke-width="1"
			/>
			<line x1="-1" y1="-1" x2="1" y2="-1" stroke="white" stroke-width="0.5" />
			<line x1="-1" y1="0" x2="1" y2="0" stroke="white" stroke-width="0.5" />
			<line x1="-1" y1="1" x2="0" y2="1" stroke="white" stroke-width="0.5" />
		</g>
	{/if}
{/snippet}

<div class="relative" {@attach panzoomAttach}>
	<MapImage
		{campaignSlug}
		{variant}
		alt="D&D Campaign Map"
		class="absolute inset-0 h-full w-full rounded-lg shadow-xl select-none"
		loading="eager"
		onLoad={(imageElement) => handleMapLoad(imageElement)}
		onError={handleMapError}
	/>

	{#if containerWidth > 0}
		<svg
			class="pointer-events-none absolute inset-0 h-full w-full mask-radial-from-85%"
			viewBox="0 0 {containerWidth} {containerHeight}"
		>
			<defs>
				<mask id="fade-mask">
					<linearGradient id="fade-x" x1="0%" y1="0%" x2="100%" y2="0%">
						<stop offset="0%" style="stop-color:black;stop-opacity:0" />
						<stop
							offset="{((xOffset - hexRadius) / containerWidth) * 100}%"
							style="stop-color:black;stop-opacity:0"
						/>
						<stop
							offset="{((xOffset + hexRadius) / containerWidth) * 100}%"
							style="stop-color:white;stop-opacity:1"
						/>
						<stop
							offset="{((containerWidth - xOffset + hexRadius / 2) / containerWidth) * 100}%"
							style="stop-color:white;stop-opacity:1"
						/>
						<stop
							offset="{((containerWidth - xOffset + hexRadius) / containerWidth) * 100}%"
							style="stop-color:black;stop-opacity:0"
						/>
						<stop offset="100%" style="stop-color:black;stop-opacity:0" />
					</linearGradient>
					<linearGradient id="fade-y" x1="0%" y1="0%" x2="0%" y2="100%">
						<stop offset="0%" style="stop-color:black;stop-opacity:0" />
						<stop
							offset="{((yOffset - 20) / containerHeight) * 100}%"
							style="stop-color:black;stop-opacity:0"
						/>
						<stop
							offset="{((yOffset + 20) / containerHeight) * 100}%"
							style="stop-color:white;stop-opacity:1"
						/>
						<stop
							offset="{((containerHeight - yOffset - 20) / containerHeight) * 100}%"
							style="stop-color:white;stop-opacity:1"
						/>
						<stop
							offset="{((containerHeight - yOffset + 20) / containerHeight) * 100}%"
							style="stop-color:black;stop-opacity:0"
						/>
						<stop offset="100%" style="stop-color:black;stop-opacity:0" />
					</linearGradient>
					<rect x="0" y="0" width={containerWidth} height={containerHeight} fill="url(#fade-x)" />
					<rect
						x="0"
						y="0"
						width={containerWidth}
						height={containerHeight}
						fill="url(#fade-y)"
						style="mix-blend-mode: multiply"
					/>
				</mask>
			</defs>
			<g mask="url(#fade-mask)">
				{#each hexGrid as hex, index (hex.id)}
					{#if hex.row >= 0}
						{@const isAlwaysRevealed = alwaysRevealedSet.has(`${hex.col}-${hex.row}`)}
						{@const shouldRender = !isAlwaysRevealed || (isDM && showAlwaysRevealed)}

						{#if shouldRender}
							<g class="group">
								<polygon
									points={hex.points}
									fill={(() => {
										const isSelected = selectedSet.has(`${hex.col}-${hex.row}`);

										// Selected tiles get orange fill (highest priority)
										if (isSelected) {
											return 'rgba(249, 115, 22, 0.6)'; // Orange with transparency
										}

										// Always-revealed tiles get blue fill
										if (isAlwaysRevealed) {
											return isDM ? 'rgba(59, 130, 246, 0.3)' : 'rgba(59, 130, 246, 0.5)';
										}

										// Regular tiles with dynamic transparency
										return isDM ? `rgba(253, 250, 240, ${tileTransparency})` : 'rgb(253, 250, 240)';
									})()}
									stroke={(() => {
										const isSelected = selectedSet.has(`${hex.col}-${hex.row}`);

										// Selected tiles get orange stroke (highest priority)
										if (isSelected) {
											return '#f97316'; // Orange
										}

										// Always-revealed tiles get blue stroke
										if (isAlwaysRevealed) {
											return '#3b82f6';
										}

										// Regular tiles
										return 'black';
									})()}
									stroke-width={(() => {
										const isSelected = selectedSet.has(`${hex.col}-${hex.row}`);

										// Selected tiles get thicker stroke
										if (isSelected) {
											return '3';
										}

										// Always-revealed tiles get medium stroke
										if (isAlwaysRevealed) {
											return '2';
										}

										// Regular tiles
										return '1';
									})()}
									class="!outline-0 {(() => {
										const isSelected = selectedSet.has(`${hex.col}-${hex.row}`);

										// Selected tiles get high stroke opacity
										if (isSelected) {
											return '[stroke-opacity:1]';
										}

										// Always-revealed tiles get medium stroke opacity
										if (isAlwaysRevealed) {
											return '[stroke-opacity:0.4]';
										}

										// Regular tiles
										return '[stroke-opacity:0.15]';
									})()} {showAnimations ? 'hover:[stroke-opacity:0.4]' : ''} {hex.row > 0
										? 'pointer-events-auto'
										: 'pointer-events-none mask-t-from-0 mask-t-to-75%'}
						  {revealedSet.has(`${hex.col}-${hex.row}`)
										? '[fill-opacity:0.2]'
										: 'cursor-pointer [fill-opacity:1]'}"
									style={showAnimations
										? 'transition: stroke-opacity 300ms, fill-opacity 300ms;'
										: ''}
									onclick={() => onHexRevealed({ hex, index })}
									onmouseenter={() => onHexHover({ x: hex.col, y: hex.row })}
									onmouseleave={() => onHexHover(null)}
									role="button"
									tabindex="0"
									aria-label="Hex {hex.row}, {hex.col}"
									onkeydown={(e) => {
										if (e.key === 'Enter' || e.key === ' ') {
											onHexRevealed({ hex, index });
										}
									}}
								/>
								{#if hex.row > 0}
									{@render label(hex, showCoords)}
									{@render indicators(hex)}
								{/if}
							</g>
						{/if}
					{/if}
				{/each}
			</g>
		</svg>
	{/if}
</div>
