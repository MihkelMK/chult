<script lang="ts">
	import type { MapMarkerResponse, UserRole } from '$lib/types';

	interface Props {
		hoveredMarker: MapMarkerResponse | null;
		effectiveRole: UserRole;
		tooltipPosition: { x: number; y: number };
	}

	let { hoveredMarker, effectiveRole, tooltipPosition }: Props = $props();
</script>

{#if hoveredMarker}
	<div
		style="position: fixed; left: {tooltipPosition.x}px; top: {tooltipPosition.y}px; pointer-events: none; z-index: 9998;"
		class="animate-in rounded-md border bg-popover px-3 py-2 text-sm text-popover-foreground shadow-md fade-in-0 zoom-in-95"
	>
		<div class="font-medium">{hoveredMarker.title}</div>
		{#if hoveredMarker.type !== 'party'}
			<div class="mt-0.5 text-xs text-muted-foreground">
				{hoveredMarker.type.charAt(0).toUpperCase() + hoveredMarker.type.slice(1)}
				{#if effectiveRole === 'dm' && !hoveredMarker.visibleToPlayers}
					<span class="ml-1">(Hidden)</span>
				{/if}
			</div>
			<div class="mt-1 text-xs text-muted-foreground/70">Click for details</div>
		{/if}
	</div>
{/if}
