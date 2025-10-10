<script lang="ts">
	import { PressedKeys } from 'runed';
	import TileDetails from './TileDetails.svelte';
	import TileContentModal from './TileContentModal.svelte';
	import { Button, buttonVariants } from '$lib/components/ui/button';
	import {
		Sheet,
		SheetContent,
		SheetHeader,
		SheetTitle,
		SheetTrigger
	} from '$lib/components/ui/sheet';
	import { Badge } from '$lib/components/ui/badge';
	import { Separator } from '$lib/components/ui/separator';
	import * as Tooltip from '$lib/components/ui/tooltip';
	import { Slider } from '$lib/components/ui/slider';
	import * as ToggleGroup from '$lib/components/ui/toggle-group/index.js';
	import * as Collapsible from '$lib/components/ui/collapsible/index.js';
	import type { HexRevealedEvent, RevealedTile, TileCoords } from '$lib/types';
	import { getCampaignState } from '$lib/contexts/campaignContext';
	import {
		Menu,
		Plus,
		Minus,
		Square,
		Eye,
		EyeOff,
		Trash2,
		MapPin,
		User,
		Users,
		Hand,
		MousePointer,
		Paintbrush,
		CircleDot,
		ChevronDownIcon,
		ChevronUpIcon
	} from '@lucide/svelte';
	import type { PlayerTileState } from '$lib/stores/playerTileManager.svelte';
	import type { TileState } from '$lib/stores/tileManager.svelte';
	import MapCanvasWrapper from './MapCanvasWrapper.svelte';
	import type { PageData } from '../../routes/(campaign)/[slug]/$types';

	interface Props {
		data: PageData;
		mode: 'player' | 'dm';
		tileState: PlayerTileState | TileState;
		tileManager: any;
		onMultiSelect?: (coords: TileCoords) => void;
		selectedTiles?: TileCoords[];
	}

	let {
		data,
		mode,
		tileState,
		tileManager,
		onMultiSelect,
		selectedTiles = $bindable([])
	}: Props = $props();

	const zoomSteps = [1, 1.5, 2, 3, 4, 5, 6, 10];

	const heldKeyboardKeys = new PressedKeys();
	let shouldCaptureKeyboard = $state(true);

	let shiftHeld = $derived(shouldCaptureKeyboard && heldKeyboardKeys.has('Shift'));
	let ctrlHeld = $derived(shouldCaptureKeyboard && heldKeyboardKeys.has('Control'));

	// UI State
	let sidebarOpen = $state(false);
	let selectedTile = $state<TileCoords | null>(null);
	let showTileDetails = $state(false);
	// Use campaign state for hover management
	const campaignState = getCampaignState();

	let selectedTool = $state<'interact' | 'pan' | 'select' | 'paint'>('interact');
	let activeTool = $derived(shiftHeld ? 'pan' : selectedTool);
	let selectedSelectMode = $state<'add' | 'remove'>('add');
	let activeSelectMode = $derived<'add' | 'remove'>(
		!ctrlHeld ? selectedSelectMode : selectedSelectMode === 'add' ? 'remove' : 'add'
	);

	let loading = $state(false);
	let brushSize = $state<number>(3); // Brush radius (1-5)
	let isDragging = $state(false);
	let alwaysRevealMode = $state(false);
	let showAlwaysRevealed = $state(false);
	let showRevealed = $state(false);
	let showUnrevealed = $state(true);
	let tileTransparency = $state('1'); // 0 = transparent, 1 = opaque
	let layerVisibilityOpen = $state(false);

	let zoomIndex = $state(0);
	let zoom = $derived(zoomSteps[zoomIndex]);

	// Computed values
	let currentRevealedTiles = $derived(
		mode === 'player' && tileState.pending
			? [...tileState.revealed, tileState.pending.map((tile) => tile.coords)]
			: tileManager?.getRevealedTiles
				? tileManager.getRevealedTiles(tileState)
				: tileState.revealed
	);

	let hasPendingOperations = $derived(
		mode === 'dm' && tileState.pending && tileState.pending.length > 0
	);

	let hasErrors = $derived(
		mode === 'dm' && 'errors' in tileState && tileState.errors && tileState.errors.length > 0
	);

	// Helper functions for tile content (using campaign state)

	function getBrushTiles(centerCoords: TileCoords): TileCoords[] {
		const tiles: TileCoords[] = [];
		const radius = brushSize - 1; // Convert size to radius (size 1 = radius 0, size 5 = radius 4)

		for (let dx = -radius; dx <= radius; dx++) {
			for (let dy = -radius; dy <= radius; dy++) {
				tiles.push({
					x: centerCoords.x + dx,
					y: centerCoords.y + dy
				});
			}
		}

		return tiles;
	}

	function hasPoI(coords: TileCoords) {
		return campaignState.getTileMarkers(coords, mode).some((m) => m.type === 'poi');
	}

	function hasNotes(coords: TileCoords) {
		return campaignState.getTileMarkers(coords, mode).some((m) => m.type === 'note');
	}

	function isPlayerPosition(coords: TileCoords) {
		return !!(
			mode === 'player' &&
			'currentPosition' in tileState &&
			tileState.currentPosition &&
			tileState.currentPosition.x === coords.x &&
			tileState.currentPosition.y === coords.y
		);
	}

	// Event handlers based on cursor mode
	function handleTileClick(event: HexRevealedEvent) {
		const coords: TileCoords = { x: event.hex.col, y: event.hex.row };

		switch (activeTool) {
			case 'interact':
				// Default action: open new tile content modal
				campaignState.openTileModal(coords);
				break;
			case 'select':
				// Multi-select mode - toggle selection
				if (mode === 'dm') {
					const selected = selectedTiles.some((t) => t.x === coords.x && t.y === coords.y);

					// Add if not selected, remove if selected
					if ((activeSelectMode === 'add') !== selected) {
						onMultiSelect?.(coords);
					}
				}
				break;
			case 'paint':
				// Paint mode - paint multiple tiles based on brush size and add/remove mode
				if (mode === 'dm') {
					const tilesToPaint = getBrushTiles(coords);
					if (activeSelectMode === 'add') {
						// Add tiles to selection
						tilesToPaint.forEach((tile) => {
							const exists = selectedTiles.some((t) => t.x === tile.x && t.y === tile.y);
							if (!exists) {
								onMultiSelect?.(tile);
							}
						});
					} else {
						// Remove tiles from selection
						tilesToPaint.forEach((tile) => {
							const exists = selectedTiles.some((t) => t.x === tile.x && t.y === tile.y);
							if (exists) {
								onMultiSelect?.(tile);
							}
						});
					}
				}
				break;
			case 'pan':
				// Pan mode - do nothing on tile click
				break;
		}
	}

	function closeTileDetails() {
		showTileDetails = false;
		selectedTile = null;
	}

	function handleHexHover(coords: TileCoords | null) {
		// Only show hover in interact mode and if tile has content
		if (activeTool === 'interact' && coords) {
			const markers = campaignState.getTileMarkers(coords, mode);
			if (markers.length > 0) {
				campaignState.setHoveredTile(coords);
			} else {
				campaignState.setHoveredTile(null);
			}
		} else {
			campaignState.setHoveredTile(null);
		}
	}

	function zoomIn() {
		if (zoomIndex < zoomSteps.length - 1) {
			zoomIndex += 1;
		}
	}

	function zoomOut() {
		if (zoomIndex > 0) {
			zoomIndex -= 1;
		}
	}

	function resetZoom() {
		zoomIndex = 0;
	}

	// Keyboard shortcuts for zoom and tool switching
	function handleKeyDown(event: KeyboardEvent) {
		if (!shouldCaptureKeyboard) return; // Only when not in input fields

		// Separate check to support estonian keyboards
		if (event.code === 'Equal' || event.key === '=' || event.key === '?') {
			event.preventDefault();
			zoomIn();
			return;
		}

		switch (event.code) {
			case 'Escape':
				event.preventDefault();
				if (selectedTiles.length > 0) {
					clearSelection();
				} else if (selectedTool !== 'interact') {
					selectedTool = 'interact';
				}
				break;

			case 'Equal':
				event.preventDefault();
				zoomIn();
				break;

			case 'Digit0':
				event.preventDefault();
				resetZoom();
				break;

			case 'Minus':
				event.preventDefault();
				zoomOut();
				break;

			case 'KeyS':
				event.preventDefault();
				setSelectedTool('select');
				break;

			case 'KeyI':
				event.preventDefault();
				setSelectedTool('interact');
				break;

			case 'KeyB':
				event.preventDefault();
				setSelectedTool('paint');
				break;

			case 'KeyP':
				event.preventDefault();
				setSelectedTool('pan');
				break;
		}
	}

	// Add global event listeners
	$effect(() => {
		document.addEventListener('keydown', handleKeyDown);

		return () => {
			document.removeEventListener('keydown', handleKeyDown);
		};
	});

	// Cursor mode functions
	function setSelectedTool(mode: 'interact' | 'pan' | 'select' | 'paint') {
		selectedTool = mode;
		if (mode !== 'select' && mode !== 'paint') {
			selectedTiles = [];
		}
	}

	// TODO: Remove this slow array parsing
	// Move over the mappings from MapCanvas
	function selectRevealed() {
		if (mode !== 'dm') return;
		loading = true;
		selectedTool = 'select';
		selectedTiles = [
			...currentRevealedTiles.filter(
				(tile: TileCoords | RevealedTile) => 'alwaysRevealed' in tile && !tile.alwaysRevealed
			)
		];
		loading = false;
	}

	function selectAlwaysRevealed() {
		if (mode !== 'dm') return;
		loading = true;
		selectedTool = 'select';
		selectedTiles = [
			...currentRevealedTiles.filter(
				(tile: TileCoords | RevealedTile) => 'alwaysRevealed' in tile && tile.alwaysRevealed
			)
		];
		loading = false;
	}

	function clearSelection() {
		selectedTiles = [];
	}

	function revealSelectedTiles() {
		if (mode === 'dm' && tileManager?.revealTiles) {
			tileManager.revealTiles(selectedTiles, alwaysRevealMode);
			selectedTiles = [];
		}
	}

	function hideSelectedTiles() {
		if (mode === 'dm' && tileManager?.hideTiles) {
			tileManager.hideTiles(selectedTiles);
			selectedTiles = [];
		}
	}

	function flushPendingOperations() {
		if (mode === 'dm' && tileManager?.flush) {
			tileManager.flush();
		}
	}
</script>

{#snippet layerControl(
	name: string,
	visibleState: boolean,
	onToggle: () => void,
	onSelect?: () => void
)}
	<div class="flex justify-between gap-6 {visibleState ? '' : 'text-muted-foreground'}">
		<div class="flex items-center">
			<Tooltip.Root>
				<Tooltip.Trigger>
					<Button variant="ghost" size="sm" onclick={() => onToggle()}>
						{#if visibleState}
							<Eye class="w-4 h-4" />
						{:else}
							<EyeOff class="w-4 h-4" />
						{/if}
					</Button>
				</Tooltip.Trigger>
				<Tooltip.Content>
					{visibleState ? `Hide ${name}` : `Show ${name}`}
				</Tooltip.Content>
			</Tooltip.Root>
			<p class="font-mono text-xs mt-[0.175em]">{name}</p>
		</div>

		{#if onSelect}
			<Tooltip.Root>
				<Tooltip.Trigger>
					<Button
						disabled={!visibleState}
						variant="ghost"
						size="icon"
						class="m-0 !p-0"
						onclick={() => onSelect()}
					>
						<Square class="w-4 h-4" />
					</Button>
				</Tooltip.Trigger>
				<Tooltip.Content>
					{visibleState ? `Select all ${name.toLowerCase()} tiles` : "Can't select hidden tiles"}
				</Tooltip.Content>
			</Tooltip.Root>
		{/if}
	</div>
{/snippet}

<!-- Full screen layout -->
<Tooltip.Provider>
	<div class="flex fixed inset-0 bg-background">
		<!-- Collapsible Sidebar -->
		<Sheet bind:open={sidebarOpen}>
			<div class="flex relative flex-col flex-1">
				<!-- Floating Toolbars -->
				<div class="flex absolute top-4 left-4 z-20 flex-col gap-2">
					<!-- Main toolbar -->
					<div
						class="flex justify-between items-center p-2 rounded-lg border min-w-80 bg-background/95 shadow-xs backdrop-blur-sm"
					>
						<div class="flex gap-2 items-center">
							<SheetTrigger>
								{#snippet child({ props })}
									<Button {...props} variant="ghost" size="sm">
										<Menu class="w-4 h-4" />
									</Button>
								{/snippet}
							</SheetTrigger>

							<div class="flex gap-2 items-center">
								<div class="text-sm font-medium">
									{data.campaign?.name || data.session?.campaignSlug}
								</div>
								<Badge variant="secondary" class="text-xs">
									{mode === 'dm' ? 'DM' : 'Player'}
								</Badge>
							</div>
						</div>

						<div class="flex gap-2 items-center">
							{#if hasErrors}
								<Badge variant="destructive" class="text-xs">Error</Badge>
							{/if}

							{#if mode === 'player' && 'error' in tileState && tileState.error}
								<Badge variant="destructive" class="text-xs">
									{tileState.error}
								</Badge>
							{/if}
							{#if selectedTool === 'select' || selectedTool === 'paint'}
								<Badge variant="secondary" class="justify-self-end text-xs">
									{selectedTiles.length} selected
								</Badge>
							{/if}
						</div>
					</div>

					<!-- DM Selection/Paint Toolbar (only when in select or paint mode) -->
					{#if mode === 'dm' && (selectedTool === 'select' || selectedTool === 'paint')}
						<div
							class="flex flex-col gap-2 items-center p-2 rounded-lg border bg-background/95 shadow-xs backdrop-blur-sm"
						>
							<div class="flex gap-2 items-center">
								<!-- Always-Reveal Toggle -->
								<Tooltip.Root>
									<Tooltip.Trigger>
										<Button
											variant={alwaysRevealMode ? 'default' : 'ghost'}
											size="sm"
											onclick={() => (alwaysRevealMode = !alwaysRevealMode)}
										>
											<CircleDot class="w-4 h-4" />
										</Button>
									</Tooltip.Trigger>
									<Tooltip.Content>
										{alwaysRevealMode ? 'Always Reveal: ON' : 'Always Reveal: OFF'}
									</Tooltip.Content>
								</Tooltip.Root>

								<!-- Select Mode Controls -->
								<Separator orientation="vertical" class="!h-6" />

								<!-- Add/Remove Mode Toggle -->
								<Tooltip.Root>
									<Tooltip.Trigger>
										<Button
											variant={activeSelectMode === 'add' ? 'default' : 'ghost'}
											size="sm"
											onclick={() => (activeSelectMode = 'add')}
										>
											<Plus class="w-4 h-4" />
										</Button>
									</Tooltip.Trigger>
									<Tooltip.Content>Add to selection</Tooltip.Content>
								</Tooltip.Root>

								<Tooltip.Root>
									<Tooltip.Trigger>
										<Button
											variant={activeSelectMode === 'remove' ? 'default' : 'ghost'}
											size="sm"
											onclick={() => (activeSelectMode = 'remove')}
										>
											<Minus class="w-4 h-4" />
										</Button>
									</Tooltip.Trigger>
									<Tooltip.Content>Remove from selection</Tooltip.Content>
								</Tooltip.Root>

								{#if selectedTool === 'select' || selectedTool === 'paint'}
									<Separator orientation="vertical" class="!h-6" />
									<Tooltip.Root>
										<Tooltip.Trigger>
											<Button
												disabled={selectedTiles.length === 0}
												variant="ghost"
												size="sm"
												onclick={revealSelectedTiles}
											>
												<Eye class="w-4 h-4" />
											</Button>
										</Tooltip.Trigger>
										<Tooltip.Content>Reveal Selected</Tooltip.Content>
									</Tooltip.Root>

									<Tooltip.Root>
										<Tooltip.Trigger>
											<Button
												disabled={selectedTiles.length === 0}
												variant="ghost"
												size="sm"
												onclick={hideSelectedTiles}
											>
												<EyeOff class="w-4 h-4" />
											</Button>
										</Tooltip.Trigger>
										<Tooltip.Content>Hide Selected</Tooltip.Content>
									</Tooltip.Root>

									<Tooltip.Root>
										<Tooltip.Trigger>
											<Button
												disabled={selectedTiles.length === 0}
												variant="ghost"
												size="sm"
												onclick={clearSelection}
											>
												<Trash2 class="w-4 h-4" />
											</Button>
										</Tooltip.Trigger>
										<Tooltip.Content>Clear Selection</Tooltip.Content>
									</Tooltip.Root>
								{/if}
							</div>
							<!-- Brush Size Slider -->
							{#if activeTool === 'paint'}
								<div class="flex gap-2 items-center">
									<div class="flex gap-2 items-center px-2">
										<span class="text-xs text-muted-foreground">Brush Size:</span>
										<div class="w-20">
											<Slider
												type="single"
												bind:value={brushSize}
												min={1}
												max={5}
												step={1}
												class="w-full"
											/>
										</div>
										<span class="w-6 font-mono text-xs text-center">{brushSize}</span>
									</div>
								</div>
							{/if}
						</div>
					{/if}
				</div>

				<!-- Zoom Controls -->
				<div class="absolute bottom-4 left-4 z-20">
					<div
						class="flex flex-col gap-1 p-1 rounded-lg border bg-background/95 shadow-xs backdrop-blur-sm"
					>
						<Tooltip.Root>
							<Tooltip.Trigger>
								<Button variant="ghost" size="sm" onclick={zoomIn}>
									<Plus class="w-4 h-4" />
								</Button>
							</Tooltip.Trigger>
							<Tooltip.Content side="right">Zoom In</Tooltip.Content>
						</Tooltip.Root>

						<Tooltip.Root>
							<Tooltip.Trigger>
								<Button
									variant="ghost"
									size="sm"
									onclick={resetZoom}
									class={zoom === 1 ? 'bg-accent' : ''}
								>
									<span class="font-mono text-xs">{zoom * 100}%</span>
								</Button>
							</Tooltip.Trigger>
							<Tooltip.Content side="right">Reset Zoom • Scroll to pan</Tooltip.Content>
						</Tooltip.Root>

						<Tooltip.Root>
							<Tooltip.Trigger>
								<Button variant="ghost" size="sm" onclick={zoomOut}>
									<Minus class="w-4 h-4" />
								</Button>
							</Tooltip.Trigger>
							<Tooltip.Content side="right">Zoom Out</Tooltip.Content>
						</Tooltip.Root>
					</div>
				</div>

				<!-- Navigation Links -->
				{#if data.session?.role === 'dm'}
					<div class="absolute top-4 right-4 z-20">
						<div
							class="flex gap-2 items-center p-2 rounded-lg border bg-background/95 shadow-xs backdrop-blur-sm"
						>
							<form action="?/toggleView" method="POST" class="contents">
								<Button variant="link" size="sm" type="submit">
									{#if mode === 'dm'}
										<Users class="mr-2 w-4 h-4" />
										Player View
									{:else}
										<User class="mr-2 w-4 h-4" />
										DM View
									{/if}
								</Button>
							</form>
						</div>
					</div>
				{/if}

				<!-- Map Container with native scroll -->
				<div
					class="overflow-auto flex-1 max-w-screen bg-muted/20"
					style="cursor: {loading
						? 'loading'
						: activeTool === 'pan'
							? isDragging
								? 'grabbing'
								: 'grab'
							: activeTool === 'paint' || activeTool === 'select'
								? activeSelectMode === 'add'
									? 'crosshair'
									: 'not-allowed'
								: 'default'} !important;"
					role="application"
					aria-label="Interactive map"
				>
					{#if data.hasMapImage}
						<MapCanvasWrapper
							campaignSlug={mode === 'dm' ? data.session?.campaignSlug : data.campaign?.slug}
							variant="detail"
							isDM={mode === 'dm'}
							showAlwaysRevealed={mode === 'dm' ? showAlwaysRevealed : false}
							showRevealed={mode === 'dm' ? showRevealed : false}
							showUnrevealed={mode === 'dm' ? showUnrevealed : true}
							tileTransparency={mode === 'dm' ? Number(tileTransparency) : 0.75}
							hexesPerRow={data.campaign?.hexesPerRow ?? 20}
							hexesPerCol={data.campaign?.hexesPerCol ?? 20}
							xOffset={data.campaign?.hexOffsetX ?? 70}
							yOffset={data.campaign?.hexOffsetY ?? 58}
							initiallyRevealed={currentRevealedTiles}
							selectedTiles={mode === 'dm' ? selectedTiles : undefined}
							showCoords={mode === 'dm' ? 'always' : 'hover'}
							onHexRevealed={handleTileClick}
							onHexHover={handleHexHover}
							{hasPoI}
							{hasNotes}
							{isPlayerPosition}
							cursorMode={activeTool}
							showAnimations={true}
							previewMode={false}
							{zoom}
						/>
					{:else}
						<div class="flex justify-center items-center h-full">
							<div class="text-center">
								<div
									class="flex justify-center items-center mx-auto mb-4 w-16 h-16 rounded-full bg-muted"
								>
									<MapPin class="w-8 h-8 text-muted-foreground" />
								</div>
								<h3 class="text-lg font-medium">Map Not Available</h3>
								<p class="text-muted-foreground">
									{#if mode === 'dm'}
										<a class="underline" href="/{data.campaign.slug}/settings">Upload a map</a>
										to get started.
									{:else}
										The campaign map is being prepared by your DM.
									{/if}
								</p>
							</div>
						</div>
					{/if}
				</div>

				<!-- Bottom Toolbar with Cursor Modes -->
				<div class="absolute bottom-4 left-1/2 z-20 -translate-x-1/2">
					<div class="flex gap-1 p-1 rounded-lg border bg-background/95 shadow-xs backdrop-blur-sm">
						<Tooltip.Root>
							<Tooltip.Trigger>
								{#snippet child({ props })}
									<Button
										{...props}
										variant={activeTool === 'interact' ? 'default' : 'ghost'}
										size="sm"
										onclick={() => setSelectedTool('interact')}
									>
										<MousePointer class="w-4 h-4" />
									</Button>
								{/snippet}
							</Tooltip.Trigger>
							<Tooltip.Content side="top">Default Cursor - Interact with hexes</Tooltip.Content>
						</Tooltip.Root>

						<Tooltip.Root>
							<Tooltip.Trigger>
								{#snippet child({ props })}
									<Button
										{...props}
										variant={activeTool === 'pan' ? 'default' : 'ghost'}
										size="sm"
										onclick={() => setSelectedTool('pan')}
									>
										<Hand class="w-4 h-4" />
									</Button>
								{/snippet}
							</Tooltip.Trigger>
							<Tooltip.Content side="top">Pan Mode - Drag or scroll to pan</Tooltip.Content>
						</Tooltip.Root>

						{#if mode === 'dm'}
							<Tooltip.Root>
								<Tooltip.Trigger>
									{#snippet child({ props })}
										<Button
											{...props}
											variant={activeTool === 'select' ? 'default' : 'ghost'}
											size="sm"
											onclick={() => setSelectedTool('select')}
											class="relative"
										>
											<Square class="w-4 h-4" />
											{#if activeTool === 'select'}
												<span
													class="absolute -top-1 -right-1 flex h-3 w-3 items-center justify-center rounded-full text-xs {activeSelectMode ===
													'add'
														? 'bg-green-500'
														: 'bg-red-500'}"
												>
													{#if activeSelectMode === 'add'}
														<Plus class="w-2 h-2 text-white" />
													{:else}
														<Minus class="w-2 h-2 text-white" />
													{/if}
												</span>
											{/if}
										</Button>
									{/snippet}
								</Tooltip.Trigger>
								<Tooltip.Content side="top"
									>Multi-select - Select hexes for bulk operations</Tooltip.Content
								>
							</Tooltip.Root>

							<Tooltip.Root>
								<Tooltip.Trigger>
									{#snippet child({ props })}
										<Button
											{...props}
											variant={activeTool === 'paint' ? 'default' : 'ghost'}
											size="sm"
											onclick={() => setSelectedTool('paint')}
											class="relative"
										>
											<Paintbrush class="w-4 h-4" />
											{#if activeTool === 'paint'}
												<span
													class="absolute -top-1 -right-1 flex h-3 w-3 items-center justify-center rounded-full text-xs {activeSelectMode ===
													'add'
														? 'bg-green-500'
														: 'bg-red-500'}"
												>
													{#if activeSelectMode === 'add'}
														<Plus class="w-2 h-2 text-white" />
													{:else}
														<Minus class="w-2 h-2 text-white" />
													{/if}
												</span>
											{/if}
										</Button>
									{/snippet}
								</Tooltip.Trigger>
								<Tooltip.Content side="top">
									Paint Mode - {activeSelectMode === 'add' ? 'Add' : 'Remove'} tiles (size {brushSize})
								</Tooltip.Content>
							</Tooltip.Root>
						{/if}
					</div>
				</div>
			</div>

			<!-- Layer Controls -->
			{#if mode === 'dm'}
				<div class="absolute right-4 bottom-4 z-20">
					<Collapsible.Root
						class="px-1 w-56 rounded-lg border bg-background/95 shadow-xs backdrop-blur-sm"
						bind:open={layerVisibilityOpen}
					>
						<div class="flex justify-between items-center py-1 pl-2">
							<h4 class="text-sm font-semibold">Layers</h4>
							<Collapsible.Trigger
								class={buttonVariants({ variant: 'ghost', size: 'sm', class: 'w-9 p-0' })}
							>
								{#if layerVisibilityOpen}
									<ChevronDownIcon />
								{:else}
									<ChevronUpIcon />
								{/if}
								<span class="sr-only">Toggle</span>
							</Collapsible.Trigger>
						</div>
						<Collapsible.Content>
							<div class="flex flex-col pb-1 bg-accent">
								{@render layerControl(
									'Always Revealed',
									showAlwaysRevealed,
									() => (showAlwaysRevealed = !showAlwaysRevealed),
									() => selectAlwaysRevealed()
								)}

								{@render layerControl(
									'Revealed',
									showRevealed,
									() => (showRevealed = !showRevealed),
									() => selectRevealed()
								)}

								{@render layerControl(
									'Unrevealed',
									showUnrevealed,
									() => (showUnrevealed = !showUnrevealed)
								)}
							</div>

							<!-- Tile Transparency Control -->
							<div class="flex gap-2 justify-between items-center py-1 pl-2">
								<span class="text-xs">Opacity</span>

								<ToggleGroup.Root
									size="sm"
									variant="text"
									type="single"
									bind:value={tileTransparency}
								>
									<ToggleGroup.Item
										value="0"
										disabled={tileTransparency === '0'}
										aria-label="Make tiles transparent"
									>
										<span class="w-6 font-mono text-xs text-center">0</span>
									</ToggleGroup.Item>
									<ToggleGroup.Item
										value="0.5"
										disabled={tileTransparency === '0.5'}
										aria-label="Make tiles half transparent"
									>
										<span class="w-6 font-mono text-xs text-center">0.5</span>
									</ToggleGroup.Item>
									<ToggleGroup.Item
										value="1"
										disabled={tileTransparency === '1'}
										aria-label="Make tiles opaque"
									>
										<span class="w-6 font-mono text-xs text-center">1</span>
									</ToggleGroup.Item>
								</ToggleGroup.Root>
							</div>
						</Collapsible.Content>
					</Collapsible.Root>
				</div>
			{/if}

			<!-- Sidebar Content -->
			<SheetContent side="left" class="w-80">
				<SheetHeader>
					<SheetTitle>
						{mode === 'dm' ? 'DM Controls' : 'Map Info'}
					</SheetTitle>
				</SheetHeader>

				<div class="px-6 mt-6 space-y-4">
					<!-- Statistics -->
					<div>
						<h3 class="mb-3 text-sm font-medium">Statistics</h3>
						<div class="space-y-2">
							<div class="flex justify-between text-sm">
								<span class="text-muted-foreground">Revealed Tiles</span>
								<span class="font-medium">{currentRevealedTiles.length}</span>
							</div>
							<div class="flex justify-between text-sm">
								<span class="text-muted-foreground">Points of Interest</span>
								<span class="font-medium">
									{data.mapMarkers?.filter((m) => m.type === 'poi').length || 0}
								</span>
							</div>
							<div class="flex justify-between text-sm">
								<span class="text-muted-foreground">Notes</span>
								<span class="font-medium">
									{data.mapMarkers?.filter((m) => m.type === 'note').length || 0}
								</span>
							</div>
							{#if hasPendingOperations}
								<div class="flex justify-between text-sm">
									<span class="text-orange-600">Pending Changes</span>
									<Badge variant="secondary">{tileState.pending?.length}</Badge>
								</div>
							{/if}
						</div>
					</div>

					<Separator />

					{#if mode === 'dm'}
						<!-- DM Controls -->
						<div>
							<h3 class="mb-3 text-sm font-medium">Tile Management</h3>
							<div class="space-y-2">
								<p class="text-sm text-muted-foreground">
									Click any tile to add POI or notes. Use multi-select for bulk reveal/hide
									operations.
								</p>

								{#if hasPendingOperations}
									<Button
										variant="outline"
										size="sm"
										class="w-full"
										onclick={flushPendingOperations}
									>
										Save {tileState.pending?.length} Changes Now
									</Button>
								{/if}
							</div>
						</div>
					{:else}
						<!-- Player Info -->
						<div>
							<h3 class="mb-3 text-sm font-medium">How to Explore</h3>
							<div class="space-y-2 text-sm text-muted-foreground">
								<p>• Click any tile to view details or add notes</p>
								<p>• Revealed tiles show explored territory</p>
								<p>• Look for POI markers on important locations</p>
								<p>• Travel mode coming soon...</p>
							</div>
						</div>

						{#if 'currentPosition' in tileState && tileState.currentPosition}
							<div>
								<h3 class="mb-3 text-sm font-medium">Current Position</h3>
								<div
									class="flex gap-2 items-center p-2 bg-green-50 rounded-md border border-green-200"
								>
									<User class="w-4 h-4 text-green-600" />
									<span class="text-sm">
										{tileState.currentPosition.x + 1}, {tileState.currentPosition.y + 1}
									</span>
								</div>
							</div>
						{/if}
					{/if}

					<Separator />

					<div class="space-y-2">
						{#if mode === 'dm'}
							<a
								href="/{data.campaign.slug}/settings"
								class={buttonVariants({ size: 'sm', variant: 'secondary', class: 'w-full' })}
								>Settings</a
							>
						{/if}
						<form action="?/logout" method="POST" class="contents">
							<Button variant="link" class="w-full cursor-pointer" size="sm" type="submit"
								>Logout</Button
							>
						</form>
					</div>
				</div>
			</SheetContent>
		</Sheet>
	</div>
</Tooltip.Provider>

<!-- Tile Details Modal (Old) -->
{#if showTileDetails && selectedTile}
	<TileDetails {selectedTile} role={mode} onClose={closeTileDetails} />
{/if}

<!-- New Tile Content Modal -->
{#if campaignState.modalTile}
	<TileContentModal
		coords={campaignState.modalTile}
		role={mode}
		bind:open={campaignState.showTileModal}
		onOpenChange={(open) => {
			if (!open) {
				campaignState.closeTileModal();
			}
		}}
	/>
{/if}
