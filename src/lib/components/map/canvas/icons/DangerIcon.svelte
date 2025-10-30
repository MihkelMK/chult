<script lang="ts">
	import { Circle, Line, RegularPolygon } from 'svelte-konva';

	interface Props {
		x: number;
		y: number;
		radius: number;
		color: string;
	}

	let { x, y, radius, color }: Props = $props();
</script>

<RegularPolygon
	{x}
	{y}
	sides={3}
	radius={radius * 0.8}
	fill={color}
	stroke="white"
	strokeWidth={2}
	rotation={0}
	shadowBlur={5}
	shadowColor="rgba(0, 0, 0, 0.3)"
/>
<!-- Exclamation mark -->
<Line
	points={[x, y - radius * 0.3, x, y + radius * 0.05]}
	stroke="white"
	strokeWidth={2.5}
	lineCap="round"
/>
<Circle {x} y={y + radius * 0.2} radius={radius * 0.08} fill="white" />
