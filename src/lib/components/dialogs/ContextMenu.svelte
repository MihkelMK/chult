<script lang="ts">
  import * as DropdownMenu from '$lib/components/ui/dropdown-menu/index.js';
  import type { ContextMenuType, MapMarkerResponse, TileCoords, UserRole } from '$lib/types';

  interface Props {
    position: { x: number; y: number };
    partyPosition: TileCoords | null;
    tile: TileCoords | null;
    type: ContextMenuType | null;
    open: boolean;
    effectiveRole: UserRole;
    selectedDMMarker: MapMarkerResponse | null;
    selectedPlayerMarker: MapMarkerResponse | null;
    startTeleport: () => void;
    openCreateMarkerDialog: (visibleToPlayers: boolean) => void;
    handleShowMarker: (marker: MapMarkerResponse) => void;
  }

  let {
    position,
    partyPosition,
    tile,
    type,
    open = $bindable(),
    effectiveRole,
    selectedDMMarker,
    selectedPlayerMarker,
    startTeleport,
    openCreateMarkerDialog,
    handleShowMarker,
  }: Props = $props();

  let anchor = $state<HTMLElement>(null!);

  let tilePosString = $derived(tile ? `${tile.x.toString().padStart(2, '0')}${tile.y.toString().padStart(2, '0')}` : '');

  let isPartyOnTile = $derived(tile && partyPosition && tile.x === partyPosition.x && tile.y === partyPosition.y);
</script>

{#snippet editMarkerItem(type: string, marker: MapMarkerResponse)}
  <DropdownMenu.Item
    class="cursor-pointer"
    onclick={() => {
      open = false;
      handleShowMarker(marker);
    }}>
    View
    {type}
    Marker
  </DropdownMenu.Item>
{/snippet}

{#snippet createMarkerItem(type: string, visibleToPlayers: boolean)}
  <DropdownMenu.Item class="cursor-pointer" onclick={() => openCreateMarkerDialog(visibleToPlayers)}>
    Create
    {type}
    Marker
  </DropdownMenu.Item>
{/snippet}

{#snippet editOrCreateMarkerItem(type: string, marker: MapMarkerResponse | null, visibleToPlayers: boolean)}
  {#if marker}
    {@render editMarkerItem(type, marker)}
  {:else}
    {@render createMarkerItem(type, visibleToPlayers)}
  {/if}
{/snippet}

<div style="position: fixed; left: {position.x}px; top: {position.y}px;  z-index: 9999;" bind:this={anchor}>
  <DropdownMenu.Root bind:open>
    <DropdownMenu.Content onEscapeKeydown={() => (open = false)} onInteractOutside={() => (open = false)} customAnchor={anchor}>
      {#if tile}
        <DropdownMenu.Label>
          Tile {tilePosString}
        </DropdownMenu.Label>
        <DropdownMenu.Separator />

        {#if effectiveRole === 'dm' && isPartyOnTile}
          <DropdownMenu.Item class="cursor-pointer" onclick={startTeleport}>Teleport Party</DropdownMenu.Item>
        {/if}
      {/if}

      {#if type === 'tile'}
        <!-- Unqualified "Create Marker": DM-only for a DM, visible for a player (the only kind they may create) -->
        <DropdownMenu.Item class="cursor-pointer" onclick={() => openCreateMarkerDialog(effectiveRole !== 'dm')}>
          Create Marker
        </DropdownMenu.Item>
      {:else if type === 'marker'}
        {#if effectiveRole === 'dm'}
          {@render editOrCreateMarkerItem('DM', selectedDMMarker, false)}
          {@render editOrCreateMarkerItem('Player', selectedPlayerMarker, true)}
        {:else}
          {@render editOrCreateMarkerItem('', selectedPlayerMarker, true)}
        {/if}
      {/if}
    </DropdownMenu.Content>
  </DropdownMenu.Root>
</div>
