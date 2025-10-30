<script lang="ts">
	import { Line } from 'svelte-konva';

	interface Props {
		x: number;
		y: number;
		radius: number;
		color: string;
	}

	let { x, y, radius, color }: Props = $props();
</script>

<!-- Outer broken square -->
<Line
	points={[
		x - radius * 0.5,
		y - radius * 0.5,
		x + radius * 0.5,
		y - radius * 0.5,
		x + radius * 0.5,
		y + radius * 0.2,
		x + radius * 0.1,
		y + radius * 0.5,
		x - radius * 0.3,
		y + radius * 0.5,
		x - radius * 0.5,
		y + radius * 0.3
	]}
	stroke={color}
	strokeWidth={3}
	fill={color}
	opacity={0.7}
	closed={true}
	shadowBlur={5}
	shadowColor="rgba(0, 0, 0, 0.3)"
/>
