<script lang="ts">
	import CustomIcon from '$lib/components/map/canvas/icons/CustomIcon.svelte';
	import DangerIcon from '$lib/components/map/canvas/icons/DangerIcon.svelte';
	import DungeonIcon from '$lib/components/map/canvas/icons/DungeonIcon.svelte';
	import GenericIcon from '$lib/components/map/canvas/icons/GenericIcon.svelte';
	import LandmarkIcon from '$lib/components/map/canvas/icons/LandmarkIcon.svelte';
	import PartyIcon from '$lib/components/map/canvas/icons/PartyIcon.svelte';
	import RestIcon from '$lib/components/map/canvas/icons/RestIcon.svelte';
	import RuinsIcon from '$lib/components/map/canvas/icons/RuinsIcon.svelte';
	import SettlementIcon from '$lib/components/map/canvas/icons/SettlementIcon.svelte';
	import WarningIcon from '$lib/components/map/canvas/icons/WarningIcon.svelte';
	import type { Hex, RightClickEvent } from '$lib/types';
	import type { MapMarkerResponse } from '$lib/types/database';
	import type { KonvaPointerEvent } from 'konva/lib/PointerEvents';
	import { Group, type KonvaMouseEvent } from 'svelte-konva';

	interface Props {
		marker: MapMarkerResponse;
		tile: Hex;
		radius?: number;
		onMarkerHover?: (marker: MapMarkerResponse | null, screenX: number, screenY: number) => void;
		onMarkerClick?: (marker: MapMarkerResponse) => void;
		onRightClick?: (event: RightClickEvent) => void;
	}

	let { marker, tile, radius = 15, onMarkerHover, onMarkerClick, onRightClick }: Props = $props();

	let markerSize = $derived(radius * 0.75);

	function handleMouseEnter(e: KonvaMouseEvent) {
		onMarkerHover?.(marker, e.evt.clientX, e.evt.clientY);
	}

	function handleMouseLeave() {
		onMarkerHover?.(null, 0, 0);
	}

	function handleClick() {
		onMarkerClick?.(marker);
	}

	function handleContextMenu(e: KonvaPointerEvent) {
		e.evt.preventDefault();
		onRightClick?.({
			type: 'marker',
			coords: { x: tile.col, y: tile.row },
			screenX: e.evt.clientX,
			screenY: e.evt.clientY
		});
	}

	// Color schemes for each marker type
	const markerColors = {
		settlement: { primary: 'rgb(147, 51, 234)', glow: 'rgba(147, 51, 234, 0.3)' }, // Purple
		dungeon: { primary: 'rgb(75, 85, 99)', glow: 'rgba(75, 85, 99, 0.3)' }, // Gray
		ruins: { primary: 'rgb(217, 119, 6)', glow: 'rgba(217, 119, 6, 0.3)' }, // Tan/Orange
		rest: { primary: 'rgb(249, 115, 22)', glow: 'rgba(249, 115, 22, 0.3)' }, // Orange
		landmark: { primary: 'rgb(20, 184, 166)', glow: 'rgba(20, 184, 166, 0.3)' }, // Teal
		danger: { primary: 'rgb(239, 68, 68)', glow: 'rgba(239, 68, 68, 0.3)' }, // Red
		warning: { primary: 'rgb(251, 146, 60)', glow: 'rgba(251, 146, 60, 0.3)' }, // Orange
		generic: { primary: 'rgb(107, 114, 128)', glow: 'rgba(107, 114, 128, 0.3)' }, // Gray
		custom: { primary: 'rgb(59, 130, 246)', glow: 'rgba(59, 130, 246, 0.3)' }, // Blue
		party: { primary: 'rgb(34, 197, 94)', glow: 'rgba(34, 197, 94, 0.3)' } // Green
	};

	let colors = $derived(
		markerColors[marker.type as keyof typeof markerColors] || markerColors.generic
	);
</script>

<Group
	listening={true}
	onmouseenter={handleMouseEnter}
	onmouseleave={handleMouseLeave}
	onclick={handleClick}
	oncontextmenu={handleContextMenu}
	staticConfig={true}
	perfectDrawEnabled={false}
	shadowForStrokeEnabled={false}
>
	{#if marker.type === 'settlement'}
		<SettlementIcon x={tile.centerX} y={tile.centerY} radius={markerSize} color={colors.primary} />
	{:else if marker.type === 'dungeon'}
		<DungeonIcon x={tile.centerX} y={tile.centerY} radius={markerSize} color={colors.primary} />
	{:else if marker.type === 'ruins'}
		<RuinsIcon x={tile.centerX} y={tile.centerY} radius={markerSize} color={colors.primary} />
	{:else if marker.type === 'rest'}
		<RestIcon x={tile.centerX} y={tile.centerY} radius={markerSize} color={colors.primary} />
	{:else if marker.type === 'landmark'}
		<LandmarkIcon x={tile.centerX} y={tile.centerY} radius={markerSize} color={colors.primary} />
	{:else if marker.type === 'danger'}
		<DangerIcon x={tile.centerX} y={tile.centerY} radius={markerSize} color={colors.primary} />
	{:else if marker.type === 'warning'}
		<WarningIcon x={tile.centerX} y={tile.centerY} radius={markerSize} color={colors.primary} />
	{:else if marker.type === 'generic'}
		<GenericIcon x={tile.centerX} y={tile.centerY} radius={markerSize} color={colors.primary} />
	{:else if marker.type === 'custom'}
		<CustomIcon x={tile.centerX} y={tile.centerY} radius={markerSize} color={colors.primary} />
	{:else if marker.type === 'party'}
		<PartyIcon x={tile.centerX} y={tile.centerY} radius={markerSize} color={colors.primary} />
	{/if}
</Group>
