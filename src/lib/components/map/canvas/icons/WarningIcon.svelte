<script lang="ts">
	import { Circle, Line } from 'svelte-konva';

	interface Props {
		x: number;
		y: number;
		radius: number;
		color: string;
	}

	let { x, y, radius, color }: Props = $props();
</script>

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
<!-- X mark -->
<Line
	points={[x - radius * 0.3, y - radius * 0.3, x + radius * 0.3, y + radius * 0.3]}
	stroke="white"
	strokeWidth={2.5}
	lineCap="round"
/>
<Line
	points={[x + radius * 0.3, y - radius * 0.3, x - radius * 0.3, y + radius * 0.3]}
	stroke="white"
	strokeWidth={2.5}
	lineCap="round"
/>
