<script lang="ts">
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu';
	import type { MapMarkerResponse, RightClickEventType, TileCoords, UserRole } from '$lib/types';

	interface Props {
		position: { x: number; y: number };
		partyPosition: TileCoords | null;
		tile: TileCoords | null;
		type: RightClickEventType | null;
		open: boolean;
		userRole: UserRole;
		selectedDMMarker: MapMarkerResponse | null;
		selectedPlayerMarker: MapMarkerResponse | null;
		startTeleport: () => void;
		openCreateMarkerDialog: () => void;
		handleShowMarker: (marker: MapMarkerResponse) => void;
	}

	let {
		position,
		partyPosition,
		tile,
		type,
		open = $bindable(),
		userRole,
		selectedDMMarker,
		selectedPlayerMarker,
		startTeleport,
		openCreateMarkerDialog,
		handleShowMarker
	}: Props = $props();

	let anchor = $state<HTMLElement>(null!);

	let tilePosString = $derived(
		tile ? `${tile.x.toString().padStart(2, '0')}${tile.y.toString().padStart(2, '0')}` : ''
	);

	let isPartyOnTile = $derived(
		tile && partyPosition && tile.x === partyPosition.x && tile.y === partyPosition.y
	);
</script>

{#snippet editMarkerItem(type: string, marker: MapMarkerResponse)}
	<DropdownMenu.Item
		class="cursor-pointer"
		onclick={() => {
			open = false;
			handleShowMarker(marker);
		}}
	>
		View
		{type}
		Marker
	</DropdownMenu.Item>
{/snippet}

{#snippet createMarkerItem(type: string)}
	<DropdownMenu.Item class="cursor-pointer" onclick={openCreateMarkerDialog}>
		Create
		{type}
		Marker
	</DropdownMenu.Item>
{/snippet}

{#snippet editOrCreateMarkerItem(type: string, marker: MapMarkerResponse | null)}
	{#if marker}
		{@render editMarkerItem(type, marker)}
	{:else}
		{@render createMarkerItem(type)}
	{/if}
{/snippet}

<div
	style="position: fixed; left: {position.x}px; top: {position.y}px;  z-index: 9999;"
	bind:this={anchor}
>
	<DropdownMenu.Root bind:open>
		<DropdownMenu.Content
			onEscapeKeydown={() => (open = false)}
			onInteractOutside={() => (open = false)}
			customAnchor={anchor}
		>
			{#if tile}
				<DropdownMenu.Label>
					Tile {tilePosString}
				</DropdownMenu.Label>
				<DropdownMenu.Separator />

				{#if userRole === 'dm' && isPartyOnTile}
					<DropdownMenu.Item class="cursor-pointer" onclick={startTeleport}>
						Teleport Party
					</DropdownMenu.Item>
				{/if}
			{/if}

			{#if type === 'tile'}
				<DropdownMenu.Item class="cursor-pointer" onclick={openCreateMarkerDialog}>
					Create Marker
				</DropdownMenu.Item>
			{:else if type === 'marker'}
				{#if userRole === 'dm'}
					{@render editOrCreateMarkerItem('DM', selectedDMMarker)}
					{@render editOrCreateMarkerItem('Player', selectedPlayerMarker)}
				{:else}
					{@render editOrCreateMarkerItem('', selectedPlayerMarker)}
				{/if}
			{/if}
		</DropdownMenu.Content>
	</DropdownMenu.Root>
</div>
