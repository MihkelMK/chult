<script lang="ts">
	import { Circle, RegularPolygon } from 'svelte-konva';

	interface Props {
		x: number;
		y: number;
		radius: number;
		color?: string;
	}

	let { x, y, radius, color = 'rgb(34, 197, 94)' }: Props = $props();
</script>

<!-- Main token circle -->
<Circle
	{x}
	{y}
	radius={radius * 0.7}
	fill={color}
	stroke="white"
	strokeWidth={2}
	shadowBlur={5}
	shadowColor="rgba(0, 0, 0, 0.3)"
/>

<!-- Inner flag icon (simplified) -->
<RegularPolygon {x} {y} sides={5} radius={radius * 0.4} fill="white" />
