<script lang="ts">
	import type { Hex, HexRendered, MapCanvasProps } from '$lib/types';
	import { Image, Layer, RegularPolygon, Stage, Text } from 'svelte-konva';

	let {
		image,
		isDM,
		isDragging = $bindable(),
		revealedTiles,
		alwaysRevealedTiles,
		unrevealedTiles,
		selectedTiles,
		xOffset = 0,
		yOffset = 0,
		hexesPerCol,
		hexesPerRow,
		hexRadius,
		zoom,
		cursorMode,
		tileTransparency,
		previewMode,
		showRevealed,
		showUnrevealed,
		showAlwaysRevealed,
		showCoords,
		imageHeight,
		imageWidth,
		onHexTriggered,
		hasNotes,
		hasPoI,
		isPlayerPosition,
		canvasHeight,
		canvasWidth
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

	function handleHexTrigger(key: string) {
		if (cursorMode === 'pan') return;
		onHexTriggered?.({ key });
	}

	let dragBoundPaddingPX = $derived(canvasWidth * 0.1);

	let imageAspectRatio = $derived(imageHeight / imageWidth);
	let canvasAspectRatio = $derived(canvasHeight / canvasWidth);

	let absoluteScale = $derived(
		imageAspectRatio > canvasAspectRatio
			? canvasHeight / (imageHeight + dragBoundPaddingPX * 2)
			: canvasWidth / (imageWidth + dragBoundPaddingPX * 2)
	);
	let previousZoom = $state(zoom);
	let scale = $derived(absoluteScale * zoom);
	let position = $state({ x: 0, y: 0 });

	let scaledImageWidth = $derived(imageWidth * scale);
	let scaledImageHeight = $derived(imageHeight * scale);

	// As we render the hexes with a 90 deg rotation, we need to flip these values
	let rotatedHexesPerCol = $derived(hexesPerRow);
	let rotatedHexesPerRow = $derived(hexesPerCol);

	const fontSize = $derived(Math.round(hexRadius * 0.35));
	const lineHeight = $state(1.7);
	const textXOffset = $derived(fontSize);
	const textYOffset = $derived(-fontSize / lineHeight);

	let gridClipX = $derived(hexRadius * 0.75);
	let gridClipY = $derived(hexRadius - 1);
	let gridWidth = $derived(imageWidth - 2 * xOffset - gridClipX * 2);
	let gridHeight = $derived(imageHeight - 2 * yOffset - gridClipY * 2);

	let lastPaintedTile = $state<string | null>(null);

	let { max: maxXPos, min: minXPos } = $derived(
		calculatePanBounds(scaledImageWidth, canvasWidth, dragBoundPaddingPX, zoom)
	);

	let { max: maxYPos, min: minYPos } = $derived(
		calculatePanBounds(scaledImageHeight, canvasHeight, dragBoundPaddingPX, zoom)
	);

	// Snap to center on first load
	$effect(() => {
		if (zoom === 1 && position.x !== maxXPos && position.y !== maxYPos) {
			position.x = maxXPos;
			position.y = maxYPos;
		}
	});

	$effect(() => {
		if (previousZoom && zoom !== previousZoom) {
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
	<RegularPolygon
		x={hex.centerX}
		y={hex.centerY}
		tileKey={hex.id}
		radius={hexRadius}
		sides={6}
		rotation={90}
		fill={previewMode ? '' : isAlways ? '#faa16a' : isRevealed ? '#bfd5fc' : 'rgb(253, 250, 240)'}
		opacity={isDM ? tileTransparency : 1}
		stroke={isAlways ? '#f97316' : 'black'}
		listening={!previewMode}
		perfectDrawEnabled={false}
		shadowForStrokeEnabled={false}
		onclick={() => handleHexTrigger(hex.id)}
	/>
	{@const isTopMost = hex.row === 0 && hex.row % 2 === 1}
	{@const isBottomMost = hex.row === rotatedHexesPerRow - 1 && hex.row % 2 === 0}
	{@const isLeftMost = hex.col === 0}
	{#if showCoords !== 'never' && !isTopMost && !isLeftMost && !isBottomMost}
		<Text
			staticConfig={true}
			listening={false}
			x={hex.centerX - textXOffset * (hex.col === rotatedHexesPerCol - 1 ? 1.75 : 1)}
			y={hex.centerY + textYOffset}
			text="{hex.col.toString().padStart(2, '0')}{hex.row.toString().padStart(2, '0')}"
			fill="#000000"
			{fontSize}
		/>
	{/if}
	<!-- {#if hex.row > 0 && showCoords !== 'never'} -->
	<!-- {@render indicators(hex)} -->
	<!-- {/if} -->
{/snippet}

{#snippet selectedTileBorder(hex: Hex)}
	<RegularPolygon
		staticConfig={true}
		perfectDrawEnabled={false}
		shadowForStrokeEnabled={false}
		listening={false}
		x={hex.centerX}
		y={hex.centerY}
		radius={hexRadius - 3}
		sides={6}
		rotation={90}
		stroke="#3b82f6"
		strokeWidth={5}
	/>
{/snippet}

<Stage
	visible={!!image}
	width={canvasWidth}
	height={canvasHeight}
	bind:x={position.x}
	bind:y={position.y}
	scaleX={scale}
	scaleY={scale}
	draggable={cursorMode === 'pan'}
	perfectDrawEnabled={false}
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
	onmousemove={(e) => {
		if (isDragging && (cursorMode === 'paint' || cursorMode === 'select')) {
			const stage = e.target.getStage();
			const pointerPos = stage?.getPointerPosition();

			if (!pointerPos) return;

			const shape = stage?.getIntersection(pointerPos);

			if (shape && shape.attrs.tileKey) {
				const key = shape.attrs.tileKey;

				if (lastPaintedTile !== key) {
					handleHexTrigger(key);
					lastPaintedTile = key;
				}
			}
		}
	}}
>
	<!-- Layer 1: Background -->
	<Layer staticConfig={true} listening={false}>
		<Image
			x={0}
			y={0}
			{image}
			cornerRadius={24}
			shadowColor="black"
			shadowBlur={25}
			shadowOffset={{ x: 0, y: 20 }}
			shadowOpacity={0.1}
		></Image>
	</Layer>

	<!-- Layer 2: Fog-of-war -->
	<Layer
		x={xOffset}
		y={yOffset}
		clipX={gridClipX}
		clipY={gridClipY}
		clipHeight={gridHeight}
		clipWidth={gridWidth}
		listening={showUnrevealed && cursorMode !== 'pan'}
		visible={showUnrevealed && tileTransparency !== 0}
	>
		{#each unrevealedTiles as hex (hex.id)}
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
			clipX={gridClipX}
			clipY={gridClipY}
			clipHeight={gridHeight}
			clipWidth={gridWidth}
			listening={showRevealed && cursorMode !== 'pan'}
			visible={showRevealed && tileTransparency !== 0}
		>
			{#each revealedTiles as hex (hex.id)}
				{#if hex.row >= 0}
					{@render tile(hex, true, false)}
				{/if}
			{/each}
		</Layer>

		<!-- Layer 4: Always-revealed tiles -->
		<Layer
			x={xOffset}
			y={yOffset}
			clipX={gridClipX}
			clipY={gridClipY}
			clipHeight={gridHeight}
			clipWidth={gridWidth}
			listening={showAlwaysRevealed && cursorMode !== 'pan'}
			visible={showAlwaysRevealed && tileTransparency !== 0}
		>
			{#each alwaysRevealedTiles as hex (hex.id)}
				{@render tile(hex, false, true)}
			{/each}
		</Layer>

		<!-- Layer 5: Selection borders (non-interactive overlay) -->
		<Layer
			x={xOffset}
			y={yOffset}
			clipX={gridClipX}
			clipY={gridClipY}
			clipHeight={gridHeight}
			clipWidth={gridWidth}
			listening={false}
			visible={selectedTiles.length > 0}
		>
			{#each selectedTiles as hex (hex.id)}
				{@render selectedTileBorder(hex)}
			{/each}
		</Layer>
	{/if}
</Stage>
