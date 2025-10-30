<script lang="ts">
	import { Circle, RegularPolygon } from 'svelte-konva';

	interface Props {
		x: number;
		y: number;
		radius: number;
		color: string;
	}

	let { x, y, radius, color }: Props = $props();
</script>

<!-- Base circle -->
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
<!-- Castle towers (simplified) -->
<RegularPolygon {x} {y} sides={4} radius={radius * 0.35} fill="white" rotation={45} />
