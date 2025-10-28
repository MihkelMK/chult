<script lang="ts">
	import PathLayer from '$lib/components/map/canvas/PathLayer.svelte';
	import PartyToken from '$lib/components/map/canvas/tokens/PartyToken.svelte';
	import type { Hex, MapCanvasProps } from '$lib/types';
	import { Group, Image, Layer, RegularPolygon, Stage, Text } from 'svelte-konva';

	let {
		image,
		isDM,
		isDragging = $bindable(),
		revealedTiles,
		alwaysRevealedTiles,
		unrevealedTiles,
		selectedTiles,
		adjacentTiles,
		partyTokenTile,
		xOffset = 0,
		yOffset = 0,
		hexesPerCol,
		hexesPerRow,
		hexRadius,
		zoom,
		activeTool,
		selectedTool,
		tileTransparency,
		previewMode,
		showRevealed,
		showUnrevealed,
		showAlwaysRevealed,
		showCoords,
		imageHeight,
		imageWidth,
		onHexTriggered,
		onRightClick,
		canvasHeight,
		canvasWidth,
		showPaths = false,
		visiblePathSessions = new Set<number>(),
		sessions = [],
		pathsMap,
		hexGrid
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
		if (activeTool === 'pan') return;
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

{#snippet tileCoords(hex: Hex)}
	<Text
		staticConfig={true}
		listening={false}
		x={hex.centerX - textXOffset * (hex.col === rotatedHexesPerCol - 1 ? 1.75 : 1)}
		y={hex.centerY + textYOffset}
		text="{hex.col.toString().padStart(2, '0')}{hex.row.toString().padStart(2, '0')}"
		fill="#000000"
		{fontSize}
	/>
{/snippet}

{#snippet tile(hex: Hex, isRevealed: boolean, isAlways: boolean)}
	<RegularPolygon
		x={hex.centerX}
		y={hex.centerY}
		tileKey={hex.id}
		radius={hexRadius}
		sides={6}
		rotation={90}
		fill={previewMode ? '' : isAlways ? '#faa16a' : isRevealed ? '#bfd5fc' : '#fdfaf0'}
		opacity={isDM ? tileTransparency : 1}
		stroke={isAlways ? '#f97316' : 'black'}
		perfectDrawEnabled={false}
		shadowForStrokeEnabled={false}
		onclick={() => handleHexTrigger(hex.id)}
	/>
	{@const isTopMost = hex.row === 0 && hex.row % 2 === 1}
	{@const isBottomMost = hex.row === rotatedHexesPerRow - 1 && hex.row % 2 === 0}
	{@const isLeftMost = hex.col === 0}
	{#if showCoords !== 'never' && !isTopMost && !isLeftMost && !isBottomMost}
		{@render tileCoords(hex)}
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

{#snippet adjacentTileHighlight(hex: Hex)}
	<Group
		staticConfig={true}
		perfectDrawEnabled={false}
		shadowForStrokeEnabled={false}
		onclick={() => handleHexTrigger(hex.id)}
	>
		<RegularPolygon
			x={hex.centerX}
			y={hex.centerY}
			radius={hexRadius}
			sides={6}
			rotation={90}
			fill="#e2ffd3"
			opacity={0.5}
		/>
		<RegularPolygon
			x={hex.centerX}
			y={hex.centerY}
			radius={hexRadius}
			sides={6}
			rotation={90}
			strokeWidth={2}
			stroke="black"
		/>
		{@render tileCoords(hex)}
	</Group>
{/snippet}

<Stage
	visible={!!image}
	width={canvasWidth}
	height={canvasHeight}
	bind:x={position.x}
	bind:y={position.y}
	scaleX={scale}
	scaleY={scale}
	draggable={activeTool === 'pan'}
	perfectDrawEnabled={false}
	dragBoundFunc={(pos) => {
		const clampedX = Math.max(Math.min(maxXPos, pos.x), minXPos);
		const clampedY = Math.max(Math.min(maxYPos, pos.y), minYPos);

		return { x: clampedX, y: clampedY };
	}}
	onmousedown={() => {
		if (activeTool === 'paint' || activeTool === 'select') {
			isDragging = true;
		}
	}}
	onmouseup={() => {
		isDragging = false;
		lastPaintedTile = null;
	}}
	onmousemove={(e) => {
		if (isDragging && (activeTool === 'paint' || activeTool === 'select')) {
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

	<!-- Layer 2: Tiles -->
	<Layer
		x={xOffset}
		y={yOffset}
		clipX={gridClipX}
		clipY={gridClipY}
		clipHeight={gridHeight}
		clipWidth={gridWidth}
	>
		<!-- 1: Fog-of-war -->
		<Group
			listening={showUnrevealed && activeTool !== 'pan'}
			visible={showUnrevealed && tileTransparency !== 0}
		>
			{#each unrevealedTiles as hex (hex.id)}
				{#if hex.row >= 0}
					{@render tile(hex, false, false)}
				{/if}
			{/each}
		</Group>
		{#if isDM}
			<!-- 2: Revealed tiles -->
			<Group
				listening={showRevealed && activeTool !== 'pan'}
				visible={showRevealed && tileTransparency !== 0}
			>
				{#each revealedTiles as hex (hex.id)}
					{#if hex.row >= 0}
						{@render tile(hex, true, false)}
					{/if}
				{/each}
			</Group>

			<!-- 3: Always-revealed tiles -->
			<Group
				listening={showAlwaysRevealed && activeTool !== 'pan'}
				visible={showAlwaysRevealed && tileTransparency !== 0}
			>
				{#each alwaysRevealedTiles as hex (hex.id)}
					{@render tile(hex, false, true)}
				{/each}
			</Group>
		{/if}
	</Layer>

	<!-- Layer 3: UI elements (non-interactive overlay) -->
	<Layer
		x={xOffset}
		y={yOffset}
		clipX={gridClipX}
		clipY={gridClipY}
		clipHeight={gridHeight}
		clipWidth={gridWidth}
	>
		<!-- 1: Highlight selected tile borders when selecting -->
		<Group
			visible={(activeTool === 'select' || activeTool === 'paint') && selectedTiles.length > 0}
			listening={false}
		>
			{#each selectedTiles as hex (`selected-${hex.id}`)}
				{@render selectedTileBorder(hex)}
			{/each}
		</Group>

		<!-- 2: Highlight possible moves when exploring -->
		<Group visible={selectedTool === 'explore' && adjacentTiles.length > 0}>
			{#each adjacentTiles as hex (`adjacent-${hex.id}`)}
				{@render adjacentTileHighlight(hex)}
			{/each}
		</Group>
	</Layer>

	<!-- Path Visualization Layer (between UI elements and party token) -->
	<PathLayer
		{sessions}
		{pathsMap}
		visibleSessionIds={visiblePathSessions}
		{showPaths}
		{hexRadius}
		{hexGrid}
		{xOffset}
		{yOffset}
	/>

	<!-- Party Token Layer (always on top) -->
	<Layer
		x={xOffset}
		y={yOffset}
		clipX={gridClipX}
		clipY={gridClipY}
		clipHeight={gridHeight}
		clipWidth={gridWidth}
	>
		<PartyToken tile={partyTokenTile} radius={hexRadius} {onRightClick} />
	</Layer>
</Stage>
