<script lang="ts">
	import { Path } from 'svelte-konva';

	interface Props {
		x: number;
		y: number;
		radius: number;
		color: string;
	}

	let { x, y, radius, color }: Props = $props();
</script>

<!-- Pin shape using Path -->
<Path
	{x}
	y={y - radius * 0.2}
	data="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"
	fill={color}
	stroke="white"
	strokeWidth={1}
	scaleX={radius * 0.06}
	scaleY={radius * 0.06}
	offsetX={12}
	offsetY={12}
	shadowBlur={5}
	shadowColor="rgba(0, 0, 0, 0.3)"
/>
