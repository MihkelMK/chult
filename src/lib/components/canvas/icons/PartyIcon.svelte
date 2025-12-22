<script lang="ts">
	import { Circle, Rect, RegularPolygon, Text } from 'svelte-konva';

	interface Props {
		x: number;
		y: number;
		radius: number;
		color?: string;
	}

	let { x, y, radius, color = 'rgb(34, 197, 94)' }: Props = $props();

	// Position the title above the token
	const fontSize = $derived(radius * 0.8);
	const textWidth = $derived(fontSize * 2.5); // Approximate width for "Party"
	const textHeight = $derived(fontSize * 1.4);
	const paddingX = $derived(radius * 0.4);
	const paddingY = $derived(paddingX * 0.3);
</script>

<!-- Main token circle -->
<Circle
	{x}
	{y}
	radius={radius * 0.85}
	fill={color}
	stroke="white"
	strokeWidth={2}
	shadowBlur={5}
	shadowColor="rgba(0, 0, 0, 0.3)"
/>

<!-- Inner flag icon (simplified) -->
<RegularPolygon {x} {y} sides={5} radius={radius * 0.5} fill="white" />

<!-- Background for title label -->
<Rect
	x={x - textWidth / 2 - paddingX}
	y={y - textHeight * 2 - paddingY * 1.5}
	width={textWidth + paddingX * 2}
	height={textHeight + paddingY}
	fill="rgba(255, 255, 255, 0.5)"
	cornerRadius={radius / 6}
	listening={false}
	perfectDrawEnabled={false}
/>

<!-- Constant title label above the token -->
<Text
	{x}
	y={y - radius - textHeight - paddingY}
	text="Party"
	{fontSize}
	fontFamily="Arial, sans-serif"
	fontStyle="bold"
	fill="black"
	align="center"
	stroke="white"
	strokeWidth={2}
	fillAfterStrokeEnabled={true}
	offsetX={fontSize * 1.25}
	listening={false}
	perfectDrawEnabled={false}
/>
