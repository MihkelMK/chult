<script lang="ts">
	import { Star } from 'svelte-konva';

	interface Props {
		x: number;
		y: number;
		radius: number;
		color: string;
	}

	let { x, y, radius, color }: Props = $props();
</script>

<Star
	{x}
	{y}
	numPoints={5}
	innerRadius={radius * 0.35}
	outerRadius={radius * 0.8}
	fill={color}
	stroke="white"
	strokeWidth={2}
	shadowBlur={5}
	shadowColor="rgba(0, 0, 0, 0.3)"
/>
<!-- Inner star -->
<Star {x} {y} numPoints={5} innerRadius={radius * 0.15} outerRadius={radius * 0.3} fill="white" />
