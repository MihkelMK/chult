<script lang="ts">
	import type { Hex, HexRendered, MapCanvasProps } from '$lib/types';
	import { Stage, Layer, Image, RegularPolygon, Text } from 'svelte-konva';

	let {
		image,
		hexGrid,
		isDM,
		selectedSet,
		revealedSet,
		alwaysRevealedSet,
		xOffset = 0,
		yOffset = 0,
		hexesPerCol,
		hexRadius,
		zoom,
		cursorMode,
		tileTransparency,
		previewMode,
		showRevealed,
		showUnrevealed,
		showAlwaysRevealed,
		showCoords,
		onHexRevealed,
		onHexHover,
		hasNotes,
		hasPoI,
		isPlayerPosition
	}: MapCanvasProps = $props();

	const calculatePanBounds = (
		elementSize: number,
		canvasSize: number,
		padding: number,
		scale: number
	) => {
		const centered = (canvasSize - elementSize) / 2;

		if (scale === 1) {
			// No zoom, element is scaled to fit canvas
			// Center and lock pan
			return { max: centered, min: centered };
		}

		if (elementSize >= canvasSize - 2 * padding) {
			// Element is larger than canvas (minus padding)
			// Allow panning to see all parts, but stop at 50px from edges
			return {
				max: padding,
				min: canvasSize - elementSize - padding
			};
		}

		// Element is smaller than canvas
		// Keep centered with max 50px deviation
		return { max: centered + padding, min: centered - padding };
	};

	function handleHexClick(hex: Hex) {
		if (cursorMode === 'pan') return;
		onHexRevealed?.({ hex });
	}

	function handleMouseEnter(coords: { x: number; y: number }) {
		clearTimeout(hoverTimeout);
		hoverTimeout = setTimeout(() => {
			onHexHover?.(coords);
		}, 150);
	}

	function handleMouseLeave() {
		clearTimeout(hoverTimeout);
		onHexHover?.(null);
	}

	let firstLoad = $state(true);

	let canvasWidth = $state(0);
	let canvasHeight = $state(0);

	let absoluteScale = $state(1);

	let dragBoundPaddingPX = $derived(canvasWidth * 0.1);
	let scale = $derived(absoluteScale * zoom);
	let position = $state({ x: 0, y: 0 });
	let previousZoom = $state(zoom);

	let portrait = $derived(image ? image.height > image.width : false);
	let scaledImageWidth = $derived(image ? image.width * scale : 0);
	let scaledImageHeight = $derived(image ? image.height * scale : 0);

	const fontSize = $derived(Math.round(hexRadius * 0.4));
	const lineHeight = $state(1.6);
	const textXOffset = $derived(fontSize);
	const textYOffset = $derived(-fontSize / lineHeight);

	let hoverTimeout: ReturnType<typeof setTimeout>;
	let isDragging = $state(false);
	let lastPaintedTile = $state<string | null>(null);

	// Filter tiles for layer based rendering
	let revealedTiles = $derived.by(() =>
		hexGrid.filter((hex) => revealedSet.has(`${hex.col}-${hex.row}`))
	);
	let alwaysRevealedTiles = $derived.by(() =>
		hexGrid.filter((hex) => alwaysRevealedSet.has(`${hex.col}-${hex.row}`))
	);
	let unrevealedTiles = $derived.by(() =>
		hexGrid.filter(
			(hex) =>
				!revealedSet.has(`${hex.col}-${hex.row}`) && !alwaysRevealedSet.has(`${hex.col}-${hex.row}`)
		)
	);

	let { max: maxXPos, min: minXPos } = $derived(
		calculatePanBounds(scaledImageWidth, canvasWidth, dragBoundPaddingPX, zoom)
	);

	let { max: maxYPos, min: minYPos } = $derived(
		calculatePanBounds(scaledImageHeight, canvasHeight, dragBoundPaddingPX, zoom)
	);

	$effect(() => {
		if (firstLoad && image) {
			firstLoad = false;

			absoluteScale = portrait
				? canvasHeight / (image.height + dragBoundPaddingPX * 2)
				: canvasWidth / (image.width + dragBoundPaddingPX * 2);
			position.x = maxXPos;
			position.y = maxYPos;
		}
	});

	$effect(() => {
		if (previousZoom && zoom !== previousZoom) {
			if (zoom === 1) {
				position.x = maxXPos;
				position.y = maxYPos;
			} else {
				const changeRatio = zoom / previousZoom;

				const centerX = canvasWidth / 2;
				const centerY = canvasHeight / 2;

				// Offset new position from center by the previous offset proportional to zoom change
				const newX = centerX - (centerX - position.x) * changeRatio;
				const newY = centerY - (centerY - position.y) * changeRatio;

				// Set new position, clamped to same values as panning
				position = {
					x: Math.max(Math.min(maxXPos, newX), minXPos),
					y: Math.max(Math.min(maxYPos, newY), minYPos)
				};
			}

			previousZoom = zoom;
		}
	});
</script>

{#snippet indicators(hex: HexRendered)}
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

{#snippet tile(hex: Hex, isRevealed: boolean, isAlways: boolean)}
	{@const key = `${hex.col}-${hex.row}`}
	{@const isSelected = isDM && selectedSet.has(key)}
	<RegularPolygon
		x={hex.centerX}
		y={hex.centerY}
		radius={hexRadius}
		sides={6}
		rotation={90}
		fill={isSelected
			? 'rgb(249, 115, 22)'
			: isAlways
				? 'rgb(59, 130, 246)'
				: isRevealed
					? '#bfd5fc'
					: 'rgb(253, 250, 240)'}
		opacity={isSelected ? 0.6 : isDM ? tileTransparency : 1}
		stroke={isSelected ? '#f97316' : isAlways ? '#3b82f6' : 'black'}
		strokeWidth={isSelected ? 3 : previewMode ? 2 : 1}
		strokeOpacity={isSelected ? 1 : isAlways ? 0.4 : 0.15}
		listening={true}
		onclick={() => handleHexClick(hex)}
		onmouseenter={() => {
			if (isDragging && (cursorMode === 'paint' || cursorMode === 'select')) {
				const key = `${hex.col}-${hex.row}`;
				if (lastPaintedTile !== key) {
					onHexRevealed?.({ hex });
					lastPaintedTile = key;
				}
			} else {
				handleMouseEnter({ x: hex.col, y: hex.row });
			}
		}}
		onmouseleave={handleMouseLeave}
		cursor={cursorMode === 'pan' ? 'grab' : 'pointer'}
	/>
	{#if hex.row > 0 && showCoords !== 'never'}
		<Text
			staticConfig={true}
			listening={false}
			x={hex.centerX - (hex.col === hexesPerCol - 1 ? 0 : textXOffset)}
			y={hex.centerY + textYOffset}
			text="{(hex.col - 1).toString().padStart(2, '0')}{hex.row.toString().padStart(2, '0')}"
			fill="#000000"
			{fontSize}
		/>
	{/if}
	<!-- {#if hex.row > 0 && showCoords !== 'never'} -->
	<!-- {@render indicators(hex)} -->
	<!-- {/if} -->
{/snippet}

<svelte:window bind:innerWidth={canvasWidth} bind:innerHeight={canvasHeight} />

{#if image}
	<Stage
		width={canvasWidth}
		height={canvasHeight}
		bind:x={position.x}
		bind:y={position.y}
		scaleX={scale}
		scaleY={scale}
		draggable={cursorMode === 'pan'}
		dragBoundFunc={(pos) => {
			const clampedX = Math.max(Math.min(maxXPos, pos.x), minXPos);
			const clampedY = Math.max(Math.min(maxYPos, pos.y), minYPos);

			return { x: clampedX, y: clampedY };
		}}
		onmousedown={() => {
			if (cursorMode === 'paint' || cursorMode === 'select') {
				isDragging = true;
			}
		}}
		onmouseup={() => {
			isDragging = false;
			lastPaintedTile = null;
		}}
		onmouseleave={() => {
			isDragging = false;
			lastPaintedTile = null;
		}}
	>
		<!-- Layer 1: Background - never cull -->
		<Layer staticConfig={true} listening={false}>
			<Image x={0} y={0} {image}></Image>
		</Layer>

		<!-- Layer 2: Fog-of-war - Only cull for DM when fog is visible -->
		<Layer
			x={xOffset}
			y={yOffset}
			listening={cursorMode !== 'pan'}
			visible={showUnrevealed && tileTransparency !== 0}
		>
			{#each unrevealedTiles as hex (hex.id)}
				<!--  ^^^^^^^^ Players: render ALL fog tiles (no culling) -->
				<!--            DMs: can cull with large buffer (5x radius) -->
				{#if hex.row >= 0}
					{@render tile(hex, false, false)}
				{/if}
			{/each}
		</Layer>

		{#if isDM}
			<!-- Layer 3: Revealed tiles -->
			<Layer
				x={xOffset}
				y={yOffset}
				listening={cursorMode !== 'pan'}
				visible={showRevealed && tileTransparency !== 0}
			>
				{#each revealedTiles as hex (hex.id)}
					{#if hex.row >= 0}
						{@render tile(hex, true, false)}
					{/if}
				{/each}
			</Layer>

			<!-- Layer 4: Always-revealed markers - SAFE to cull -->
			<Layer
				x={xOffset}
				y={yOffset}
				listening={cursorMode !== 'pan'}
				visible={showAlwaysRevealed && tileTransparency !== 0}
			>
				{#each alwaysRevealedTiles as hex (hex.id)}
					{@render tile(hex, false, true)}
				{/each}
			</Layer>
		{/if}
	</Stage>
{/if}
