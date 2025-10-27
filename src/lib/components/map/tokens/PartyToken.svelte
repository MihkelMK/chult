<script lang="ts">
	import type { Hex, RightClickEvent } from '$lib/types';
	import type { KonvaPointerEvent } from 'konva/lib/PointerEvents';
	import { Circle, Group, RegularPolygon } from 'svelte-konva';

	interface Props {
		tile: Hex | null;
		radius?: number;
		onRightClick?: (event: RightClickEvent) => void;
	}

	let { tile, radius = 15, onRightClick }: Props = $props();

	function handleContextMenu(e: KonvaPointerEvent) {
		if (!tile || !onRightClick) return;

		e.evt.preventDefault();
		onRightClick({
			type: 'token',
			coords: { x: tile.col, y: tile.row },
			screenX: e.evt.clientX,
			screenY: e.evt.clientY
		});
	}
</script>

{#if tile}
	<Group listening={true} oncontextmenu={handleContextMenu}>
		<!-- Outer glow -->
		<Circle
			x={tile.centerX}
			y={tile.centerY}
			radius={radius * 0.6}
			fill="rgba(34, 197, 94, 0.3)"
			shadowBlur={10}
			shadowColor="rgba(34, 197, 94, 0.5)"
		/>

		<!-- Main token circle -->
		<Circle
			x={tile.centerX}
			y={tile.centerY}
			radius={radius * 0.5}
			fill="rgb(34, 197, 94)"
			stroke="white"
			strokeWidth={3}
			shadowBlur={5}
			shadowColor="rgba(0, 0, 0, 0.3)"
			shadowOffset={{ x: 0, y: 2 }}
		/>

		<!-- Inner flag icon (simplified) -->
		<RegularPolygon
			x={tile.centerX}
			y={tile.centerY}
			sides={6}
			radius={radius * 0.25}
			fill="white"
		/>
	</Group>
{/if}
