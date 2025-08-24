<script lang="ts">
	import { onMount } from 'svelte';

	interface Hex {
		id: string;
		row: number;
		col: number;
		centerX: number;
		centerY: number;
		points: string;
		revealed: boolean;
	}

	interface HexRevealedEvent {
		hex: Hex;
		index: number;
	}

	interface Props {
		mapSrc?: string;
		hexesPerRow?: number; // Number of hexagons per row on the actual map
		hexesPerCol?: number; // Number of hexagons per column on the actual map
		xOffset?: number; // Horizontal offset in pixels from left edge to where grid starts
		yOffset?: number; // Vertical offset in pixels from top edge to where grid starts
		showControls?: boolean;
		initiallyRevealed?: boolean;
		onHexRevealed?: (event: HexRevealedEvent) => void;
		onAllHexesReset?: () => void;
		onAllHexesRevealed?: () => void;
	}

	let {
		mapSrc = '',
		hexesPerRow = 72,
		hexesPerCol = 86,
		xOffset = 70,
		yOffset = 58,
		showControls = true,
		initiallyRevealed = false,
		onHexRevealed = () => {},
		onAllHexesReset = () => {},
		onAllHexesRevealed = () => {}
	}: Props = $props();

	let mapContainer: HTMLDivElement | undefined = $state();
	let mapImage: HTMLImageElement | undefined = $state();
	let hexGrid: Hex[] = $state([]);
	let imageNaturalDimensions = $state({ width: 0, height: 0 });
	let mounted: boolean = $state(false);

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

	// Generate hex grid when dimensions change
	$effect(() => {
		if (mounted && imageNaturalDimensions.width > 0) {
			generateHexGrid();
		}
	});

	onMount(() => {
		mounted = true;
	});

	function handleImageLoad(): void {
		if (mapImage) {
			// Get the natural (original) dimensions of the image
			imageNaturalDimensions = {
				width: mapImage.naturalWidth,
				height: mapImage.naturalHeight
			};
		}
	}

	function generateHexGrid(): void {
		const newHexGrid: Hex[] = [];

		for (let row = 0; row < rows; row++) {
			for (let col = 0; col < cols; col++) {
				// Perfect tessellation for flat-top hexagons: odd columns offset vertically
				const offsetY = (col % 2) * (verticalSpacing * 0.5);
				// Apply the xOffset and yOffset to position the grid correctly
				const centerX = col * horizontalSpacing + hexRadius + xOffset;
				const centerY = row * verticalSpacing + offsetY + hexHeight / 2 + yOffset;

				// Generate flat-top hex vertices
				const points = generateFlatTopHexPoints(centerX, centerY, hexRadius);

				newHexGrid.push({
					id: `hex-${row}-${col}`,
					row,
					col,
					centerX,
					centerY,
					points,
					revealed: initiallyRevealed
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

	function revealHex(hexIndex: number): void {
		const hex = hexGrid[hexIndex];
		if (hex) {
			hex.revealed = true;
			hexGrid = [...hexGrid]; // Trigger reactivity

			onHexRevealed({
				hex,
				index: hexIndex
			});
		}
	}

	function resetAllHexes(): void {
		hexGrid = hexGrid.map((hex) => ({ ...hex, revealed: false }));
		onAllHexesReset();
	}

	function revealAllHexes(): void {
		hexGrid = hexGrid.map((hex) => ({ ...hex, revealed: true }));
		onAllHexesRevealed();
	}

	function toggleHexVisibility(): void {
		const revealedCount = hexGrid.filter((hex) => hex.revealed).length;
		const hiddenCount = hexGrid.length - revealedCount;

		if (hiddenCount > revealedCount) {
			revealAllHexes();
		} else {
			resetAllHexes();
		}
	}
</script>

{#if showControls}
	<div class="my-5 flex flex-wrap justify-center gap-3">
		<button
			class="rounded-lg bg-blue-500 px-5 py-2 font-medium text-white transition-colors duration-300 hover:bg-blue-600"
			onclick={resetAllHexes}
		>
			Reset All Hexes
		</button>
		<button
			class="rounded-lg bg-gray-500 px-5 py-2 font-medium text-white transition-colors duration-300 hover:bg-gray-600"
			onclick={revealAllHexes}
		>
			Reveal All Hexes
		</button>
		<button
			class="rounded-lg bg-gray-500 px-5 py-2 font-medium text-white transition-colors duration-300 hover:bg-gray-600"
			onclick={toggleHexVisibility}
		>
			Toggle Hex Visibility
		</button>
	</div>
{/if}

<div class="relative inline-block rounded-lg bg-white shadow-xl">
	<div
		class="relative"
		style="width: {containerWidth}px; height: {containerHeight}px;"
		bind:this={mapContainer}
	>
		<img
			bind:this={mapImage}
			src={mapSrc}
			alt="D&D Map"
			class="absolute inset-0 h-full w-full select-none"
			draggable="false"
			onload={handleImageLoad}
		/>

		{#if containerWidth > 0}
			<svg
				class="pointer-events-none absolute inset-0 h-full w-full"
				viewBox="0 0 {containerWidth} {containerHeight}"
			>
				{#each hexGrid as hex, index (hex.id)}
					<g class="group">
						<polygon
							points={hex.points}
							fill="rgba(253, 250, 240, 0.1)"
							stroke="rgba(0, 0, 0, 0.2)"
							stroke-width="1"
							class="pointer-events-auto {hex.revealed
								? '[fill-opacity:0] group-hover:[fill-opacity:0.5]'
								: 'cursor-pointer [fill-opacity:1]'}"
							style="transition: fill-opacity 300ms;"
							onclick={() => revealHex(index)}
							role="button"
							tabindex="0"
							aria-label="Hex {hex.row}, {hex.col}"
							onkeydown={(e) => {
								if (e.key === 'Enter' || e.key === ' ') {
									revealHex(index);
								}
							}}
						/>
						<text
							x={hex.centerX}
							y={hex.centerY + 2}
							text-anchor="middle"
							font-size="6"
							fill="black"
							style="transition: fill-opacity 300ms;"
							class={hex.revealed
								? '[fill-opacity:0.5] group-hover:[fill-opacity:1]'
								: '[fill-opacity:1]'}
							pointer-events="none"
						>
							{hex.row}, {hex.col}
						</text>
					</g>
				{/each}
			</svg>
		{/if}
	</div>
</div>
