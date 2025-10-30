<script lang="ts">
	import { Circle } from 'svelte-konva';

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
	radius={radius * 0.5}
	fill={color}
	stroke="white"
	strokeWidth={2}
	shadowBlur={5}
	shadowColor="rgba(0, 0, 0, 0.3)"
/>
