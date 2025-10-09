<script lang="ts">
	import type { HexRendered, MapCanvasProps } from '$lib/types';
	import type { GroupConfig } from 'konva/lib/Group';
	import { onMount } from 'svelte';
	import { Stage, Layer, Image, RegularPolygon, Group, Text } from 'svelte-konva';

	let {
		image,
		hexRenderData,
		xOffset = 0,
		yOffset = 0,
		cursorMode,
		zoom,
		hasNotes,
		hasPoI,
		isPlayerPosition,
		hexesPerCol,
		hexRadius,
		previewMode,
		showCoords
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

	let firstLoad = $state(true);
	let tileGroupEl: GroupConfig | undefined = $state();

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

	onMount(() => {
		tileGroupEl?.cache();

		return tileGroupEl?.clearCache();
	});
</script>

{#snippet label(
	hex: HexRendered,
	showWhen: 'never' | 'hover' | 'always' | undefined,
	fontSize: number,
	textXOffset: number,
	textYOffset: number
)}
	{#if showWhen !== 'never'}
		<Text
			listening={false}
			x={hex.centerX - (hex.col === hexesPerCol - 1 ? 0 : textXOffset)}
			y={hex.centerY + textYOffset}
			text="{(hex.col - 1).toString().padStart(2, '0')}{hex.row.toString().padStart(2, '0')}"
			fill="#000000"
			{fontSize}
		/>
	{/if}
{/snippet}

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
	>
		<Layer staticConfig={true} listening={false}>
			<Image x={0} y={0} {image} staticConfig={true}></Image>
		</Layer>
		<Layer x={xOffset} y={yOffset} bind:handle={tileGroupEl}>
			<!-- <Rect width={image.width - xOffset * 2} height={image.height - yOffset * 2} fill="black" /> -->
			<!-- <Rect width={hexRadius * hexesPerRow * 1.5} height={hexHeight * hexesPerCol} fill="red" /> -->
			<Group>
				{#each hexRenderData as hex (hex.id)}
					{#if hex.row >= 0 && hex.shouldRender}
						<Group>
							{#if previewMode}
								<RegularPolygon
									listening={false}
									x={hex.centerX}
									y={hex.centerY}
									radius={hexRadius}
									sides={6}
									fill={hex.fill}
									stroke={hex.stroke}
									strokeWidth={Number(hex.strokeWidth)}
									stroke-opacity={hex.strokeOpacity}
									rotation={90}
								/>
							{:else}
								<RegularPolygon
									x={hex.centerX}
									y={hex.centerY}
									radius={hexRadius}
									sides={6}
									fill="white"
									stroke={hex.stroke}
									strokeWidth={Number(hex.strokeWidth)}
									opacity={Number(hex.fillOpacity)}
									rotation={90}
								/>
								{@const fontSize = Math.round(hexRadius * 0.4)}
								{@const lineHeight = 1.6}
								{@const textXOffset = fontSize}
								{@const textYOffset = -fontSize / lineHeight}
								{#if hex.row > 0}
									{@render label(hex, showCoords, fontSize, textXOffset, textYOffset)}
									<!-- {@render indicators(hex)} -->
								{/if}
							{/if}
							<!-- Don't render labels or indicators in preview mode -->
						</Group>
					{/if}
				{/each}
			</Group>
		</Layer>
	</Stage>
{/if}
