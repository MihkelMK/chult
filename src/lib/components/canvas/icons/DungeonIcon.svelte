<script lang="ts">
	import { RegularPolygon } from 'svelte-konva';

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
	rotation={180}
	shadowBlur={5}
	shadowColor="rgba(0, 0, 0, 0.3)"
/>
<!-- Inner detail -->
<RegularPolygon {x} {y} sides={3} radius={radius * 0.4} fill="white" rotation={180} />
