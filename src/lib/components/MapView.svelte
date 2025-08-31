<script lang="ts">
	import Map from './Map.svelte';
	import TileDetails from './TileDetails.svelte';
	import TileContentPreview from './TileContentPreview.svelte';
	import TileContentModal from './TileContentModal.svelte';
	import { Button } from '$lib/components/ui/button';
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
	import type { HexRevealedEvent, TileCoords } from '$lib/types';
	import type { PageData } from '../../routes/(campaign)/[slug]/map/$types';
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
		Circle,
		CircleDot
	} from '@lucide/svelte';
	import { onMount } from 'svelte';
	import { Tween } from 'svelte/motion';

	interface Props {
		data: PageData;
		mode: 'player' | 'dm';
		tileState: any;
		tileManager: any;
		onTileAction?: (coords: TileCoords) => void;
		onMultiSelect?: (coords: TileCoords) => void;
		selectedTiles?: TileCoords[];
	}

	let {
		data,
		mode,
		tileState,
		tileManager,
		onTileAction,
		onMultiSelect,
		selectedTiles = []
	}: Props = $props();

	// UI State
	let sidebarOpen = $state(false);
	let selectedTile = $state<TileCoords | null>(null);
	let showTileDetails = $state(false);
	// Use campaign state for hover management
	const campaignState = getCampaignState();
	let cursorMode = $state<'interact' | 'pan' | 'select' | 'paint'>('interact');
	let brushSize = $state<number>(1); // Brush radius (1-5)
	let paintMode = $state<'add' | 'remove'>('add');
	let isPainting = $state(false);
	let alwaysRevealMode = $state(false);
	let showAlwaysRevealed = $state(false);
	let tileTransparency = $state(0.75); // 0 = transparent, 1 = opaque
	// Map and viewport dimensions for fit calculation
	let mapDimensions = $state({ width: 0, height: 0 });
	let viewportDimensions = $state({ width: 0, height: 0 });

	let relativeZoom = new Tween(1); // Zoom level relative to fit (1x = fit, 2x = double fit, etc.)
	let fitZoom = $derived(calculateFitZoom()); // Calculated zoom to fit map in viewport
	let mapZoom = $derived(fitZoom * relativeZoom.current);

	// Pan tool drag functionality
	let isDragging = $state(false);
	let dragStartX = $state(0);
	let dragStartY = $state(0);
	let scrollContainer: HTMLElement | null = $state(null);

	// Computed values
	let currentRevealedTiles = $derived(
		mode === 'player' && tileState.pending
			? [...tileState.revealed, tileState.pending.coords]
			: tileManager?.getRevealedTiles
				? tileManager.getRevealedTiles(tileState)
				: tileState.revealed
	);

	let hasPendingOperations = $derived(
		mode === 'dm' && tileState.pending && tileState.pending.length > 0
	);

	let hasErrors = $derived(mode === 'dm' && tileState.errors && tileState.errors.length > 0);

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
		return (
			mode === 'player' &&
			tileState.currentPosition &&
			tileState.currentPosition.x === coords.x &&
			tileState.currentPosition.y === coords.y
		);
	}

	// Event handlers based on cursor mode
	function handleTileClick(event: HexRevealedEvent) {
		const coords: TileCoords = { x: event.hex.col, y: event.hex.row };

		switch (cursorMode) {
			case 'interact':
				// Default action: open new tile content modal
				campaignState.openTileModal(coords);
				break;
			case 'select':
				// Multi-select mode - toggle selection
				if (mode === 'dm') {
					onMultiSelect?.(coords);
				}
				break;
			case 'paint':
				// Paint mode - paint multiple tiles based on brush size and add/remove mode
				if (mode === 'dm') {
					const tilesToPaint = getBrushTiles(coords);
					if (paintMode === 'add') {
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
					isPainting = true;
				}
				break;
			case 'pan':
				// Pan mode - do nothing on tile click
				break;
		}
	}

	function toggleSidebar() {
		sidebarOpen = !sidebarOpen;
	}

	function closeTileDetails() {
		showTileDetails = false;
		selectedTile = null;
	}

	function handleHexHover(coords: TileCoords | null) {
		// Only show hover in interact mode and if tile has content
		if (cursorMode === 'interact' && coords) {
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

	// Handle map load to get dimensions
	function handleMapLoad(dimensions: { width: number; height: number }) {
		mapDimensions = dimensions;
	}

	function zoomIn() {
		if (relativeZoom.target < 3) {
			relativeZoom.set(relativeZoom.target + 1);
		}
	}

	function zoomOut() {
		if (relativeZoom.target > 1) {
			relativeZoom.set(relativeZoom.target - 1);
		}
	}

	// Calculate zoom to fit map in full viewport (padding is separate for panning space)
	function calculateFitZoom() {
		if (!mapDimensions?.width || !viewportDimensions?.width) return 1;

		const scaleX = viewportDimensions.width / mapDimensions.width;
		const scaleY = viewportDimensions.height / mapDimensions.height;

		// Use the smaller scale to ensure the map fits in both dimensions
		const calculatedFit = Math.min(scaleX, scaleY, 1); // Don't zoom in beyond 100%

		return Math.max(0.1, calculatedFit); // Don't go below 10%
	}

	// Auto-center when zoom is set to 1x (fit zoom)
	let mapElement: HTMLElement | null = $state(null);

	$effect(() => {
		if (relativeZoom.target === 1 && mapElement) {
			// Use scrollIntoView to center the map
			mapElement.scrollIntoView({
				behavior: 'smooth',
				block: 'center',
				inline: 'center'
			});
		}
	});

	onMount(() => {
		if (relativeZoom.target === 1 && mapElement) {
			// Use scrollIntoView to center the map
			mapElement.scrollIntoView({
				behavior: 'smooth',
				block: 'center',
				inline: 'center'
			});
		}
	});

	function resetZoom() {
		relativeZoom.set(1); // Reset to 1x relative zoom (fit)
	}

	// Pan tool drag handlers
	function handleMouseDown(event: MouseEvent) {
		if (cursorMode !== 'pan' || !scrollContainer) return;

		isDragging = true;
		dragStartX = event.clientX;
		dragStartY = event.clientY;
		event.preventDefault();
	}

	function handleMouseMove(event: MouseEvent) {
		if (!isDragging || !scrollContainer) return;

		const deltaX = dragStartX - event.clientX;
		const deltaY = dragStartY - event.clientY;

		scrollContainer.scrollLeft += deltaX;
		scrollContainer.scrollTop += deltaY;

		dragStartX = event.clientX;
		dragStartY = event.clientY;
	}

	function handleMouseUp() {
		isDragging = false;
	}

	// Keyboard shortcuts for zoom
	function handleKeyDown(event: KeyboardEvent) {
		if (event.target !== document.body) return; // Only when not in input fields

		switch (event.key) {
			case '+':
			case '=':
				event.preventDefault();
				zoomIn();
				break;
			case '-':
				event.preventDefault();
				zoomOut();
				break;
			case '0':
				event.preventDefault();
				resetZoom();
				break;
		}
	}

	// Track viewport dimensions
	$effect(() => {
		if (scrollContainer) {
			const updateDimensions = () => {
				viewportDimensions = {
					width: scrollContainer!.clientWidth,
					height: scrollContainer!.clientHeight
				};
			};

			updateDimensions();

			const resizeObserver = new ResizeObserver(updateDimensions);
			resizeObserver.observe(scrollContainer);

			return () => resizeObserver.disconnect();
		}
	});

	// Add global event listeners
	$effect(() => {
		document.addEventListener('keydown', handleKeyDown);
		document.addEventListener('mousemove', handleMouseMove);
		document.addEventListener('mouseup', handleMouseUp);

		return () => {
			document.removeEventListener('keydown', handleKeyDown);
			document.removeEventListener('mousemove', handleMouseMove);
			document.removeEventListener('mouseup', handleMouseUp);
		};
	});

	// Cursor mode functions
	function setCursorMode(mode: 'interact' | 'pan' | 'select' | 'paint') {
		cursorMode = mode;
		if (mode !== 'select' && mode !== 'paint') {
			selectedTiles = [];
		}
	}

	function selectAllRevealed() {
		if (mode === 'dm') {
			selectedTiles = [...currentRevealedTiles];
		}
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

	function toggleAlwaysRevealedTiles() {
		if (mode === 'dm' && tileManager?.toggleAlwaysRevealed) {
			tileManager.toggleAlwaysRevealed(selectedTiles, !alwaysRevealMode);
			selectedTiles = [];
		}
	}

	function flushPendingOperations() {
		if (mode === 'dm' && tileManager?.flush) {
			tileManager.flush();
		}
	}
</script>

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
						class="flex gap-2 items-center p-2 rounded-lg border bg-background/95 shadow-xs backdrop-blur-sm"
					>
						<SheetTrigger>
							{#snippet child({ props })}
								<Button {...props} variant="ghost" size="sm">
									<Menu class="w-4 h-4" />
								</Button>
							{/snippet}
						</SheetTrigger>

						<Separator orientation="vertical" class="h-6" />

						<div class="flex gap-2 items-center">
							<div class="text-sm font-medium">
								{data.campaign?.name || data.session?.campaignSlug}
							</div>
							<Badge variant="secondary" class="text-xs">
								{mode === 'dm' ? 'DM' : 'Player'}
							</Badge>
						</div>

						{#if hasErrors}
							<Separator orientation="vertical" class="h-6" />
							<Badge variant="destructive" class="text-xs">Error</Badge>
						{/if}

						{#if mode === 'player' && tileState.error}
							<Separator orientation="vertical" class="h-6" />
							<Badge variant="destructive" class="text-xs">
								{tileState.error}
							</Badge>
						{/if}

						<!-- DM Transparency Control -->
						{#if mode === 'dm'}
							<Separator orientation="vertical" class="h-6" />
							<div class="flex gap-2 items-center">
								<span class="text-xs text-muted-foreground">Tile opacity:</span>
								<div class="w-20">
									<Slider
										type="single"
										bind:value={tileTransparency}
										min={0}
										max={1}
										step={0.05}
										class="w-full"
									/>
								</div>
								<span class="w-8 font-mono text-xs text-center"
									>{Math.round(tileTransparency * 100)}%</span
								>
							</div>
						{/if}
					</div>

					<!-- DM Selection/Paint Toolbar (only when in select or paint mode) -->
					{#if mode === 'dm' && (cursorMode === 'select' || cursorMode === 'paint')}
						<div
							class="flex gap-2 items-center p-2 rounded-lg border bg-background/95 shadow-xs backdrop-blur-sm"
						>
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

							<!-- Show Always-Revealed Toggle -->
							<Separator orientation="vertical" class="h-6" />

							<Tooltip.Root>
								<Tooltip.Trigger>
									<Button
										variant={showAlwaysRevealed ? 'default' : 'ghost'}
										size="sm"
										onclick={() => (showAlwaysRevealed = !showAlwaysRevealed)}
									>
										{#if showAlwaysRevealed}
											<Eye class="w-4 h-4" />
										{:else}
											<EyeOff class="w-4 h-4" />
										{/if}
									</Button>
								</Tooltip.Trigger>
								<Tooltip.Content>
									{showAlwaysRevealed ? 'Hide Always-Revealed' : 'Show Always-Revealed'}
								</Tooltip.Content>
							</Tooltip.Root>

							<!-- Paint Mode Controls (only in paint mode) -->
							{#if cursorMode === 'paint'}
								<Separator orientation="vertical" class="h-6" />

								<!-- Add/Remove Mode Toggle -->
								<Tooltip.Root>
									<Tooltip.Trigger>
										<Button
											variant={paintMode === 'add' ? 'default' : 'ghost'}
											size="sm"
											onclick={() => (paintMode = 'add')}
										>
											<Plus class="w-4 h-4" />
										</Button>
									</Tooltip.Trigger>
									<Tooltip.Content>Add Mode - Paint to add tiles</Tooltip.Content>
								</Tooltip.Root>

								<Tooltip.Root>
									<Tooltip.Trigger>
										<Button
											variant={paintMode === 'remove' ? 'default' : 'ghost'}
											size="sm"
											onclick={() => (paintMode = 'remove')}
										>
											<Minus class="w-4 h-4" />
										</Button>
									</Tooltip.Trigger>
									<Tooltip.Content>Remove Mode - Paint to remove tiles</Tooltip.Content>
								</Tooltip.Root>

								<!-- Brush Size Slider -->
								<Separator orientation="vertical" class="h-6" />

								<div class="flex gap-2 items-center px-2">
									<span class="text-xs text-muted-foreground">Size:</span>
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
							{/if}

							{#if selectedTiles.length > 0}
								<Separator orientation="vertical" class="h-6" />
								<Badge variant="secondary" class="text-xs">
									{selectedTiles.length} selected
								</Badge>

								<Tooltip.Root>
									<Tooltip.Trigger>
										<Button variant="ghost" size="sm" onclick={revealSelectedTiles}>
											<Eye class="w-4 h-4" />
										</Button>
									</Tooltip.Trigger>
									<Tooltip.Content>Reveal Selected</Tooltip.Content>
								</Tooltip.Root>

								<Tooltip.Root>
									<Tooltip.Trigger>
										<Button variant="ghost" size="sm" onclick={hideSelectedTiles}>
											<EyeOff class="w-4 h-4" />
										</Button>
									</Tooltip.Trigger>
									<Tooltip.Content>Hide Selected</Tooltip.Content>
								</Tooltip.Root>

								<Tooltip.Root>
									<Tooltip.Trigger>
										<Button variant="ghost" size="sm" onclick={clearSelection}>
											<Trash2 class="w-4 h-4" />
										</Button>
									</Tooltip.Trigger>
									<Tooltip.Content>Clear Selection</Tooltip.Content>
								</Tooltip.Root>
							{:else}
								<Button variant="ghost" size="sm" onclick={selectAllRevealed}>
									Select All Revealed
								</Button>
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
									class={relativeZoom.current !== 1 ? 'bg-accent' : ''}
								>
									<span class="font-mono text-xs">{relativeZoom.target}x</span>
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
								<Button variant="ghost" size="sm" type="submit">
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
					class="overflow-auto flex-1 bg-muted/20"
					style="cursor: {cursorMode === 'pan'
						? isDragging
							? 'grabbing'
							: 'grab'
						: cursorMode === 'paint'
							? paintMode === 'add'
								? 'crosshair'
								: 'not-allowed'
							: 'default'}; width: 0; min-width: 100%;"
					bind:this={scrollContainer}
					onmousedown={handleMouseDown}
					onkeydown={(e) => {
						// Handle keyboard navigation if needed
						if (e.key === 'Escape') {
							// Cancel current operation
							if (cursorMode === 'paint' || cursorMode === 'select') {
								selectedTiles = [];
							}
						}
					}}
					role="application"
					aria-label="Interactive map"
				>
					{#if data.hasMapImage}
						<div
							style="
							padding: {mapDimensions.width > mapDimensions.height
								? `${mapDimensions.height * 0.2 * mapZoom}px ${mapDimensions.width * 0.8 * (mapZoom - 1)}px`
								: `${mapDimensions.height * 0.8 * (mapZoom - 1)}px ${mapDimensions.width * 0.2 * mapZoom}px`}; 
							width: fit-content; 
							margin: 0 auto;
						"
						>
							<div
								class="transition-transform duration-200 ease-out"
								style="transform: scale({mapZoom}); transform-origin: center center;"
								bind:this={mapElement}
							>
								<Map
									campaignSlug={mode === 'dm' ? data.session?.campaignSlug : data.campaign?.slug}
									variant={mode === 'dm' ? 'hexGrid' : 'responsive'}
									isDM={mode === 'dm'}
									isSelecting={cursorMode === 'select' || cursorMode === 'paint'}
									showAlwaysRevealed={mode === 'dm' ? showAlwaysRevealed : false}
									tileTransparency={mode === 'dm' ? tileTransparency : 0.75}
									initiallyRevealed={currentRevealedTiles}
									selectedTiles={mode === 'dm' ? selectedTiles : undefined}
									showControls={false}
									showCoords={mode === 'dm' ? 'always' : 'hover'}
									onHexRevealed={handleTileClick}
									onHexHover={handleHexHover}
									onMapLoad={handleMapLoad}
									{hasPoI}
									{hasNotes}
									{isPlayerPosition}
								/>
							</div>

							<!-- Hover Preview Overlay -->
							{#if campaignState.hoveredTile}
								<TileContentPreview
									coords={campaignState.hoveredTile}
									markers={campaignState.getTileMarkers(campaignState.hoveredTile, mode)}
									campaignSlug={data.campaign?.slug || data.session?.campaignSlug}
									role={mode}
								>
									{#snippet children()}
										<!-- Invisible trigger element positioned over the hovered hex -->
										<div
											class="absolute pointer-events-none"
											style="left: 0; top: 0; width: 1px; height: 1px;"
										></div>
									{/snippet}
								</TileContentPreview>
							{/if}
						</div>
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
									{mode === 'dm'
										? 'Upload a map image to get started.'
										: 'The campaign map is being prepared by your DM.'}
								</p>
							</div>
						</div>
					{/if}
				</div>

				<!-- Bottom Toolbar with Cursor Modes -->
				<div class="absolute right-4 bottom-4 z-20">
					<div class="flex gap-1 p-1 rounded-lg border bg-background/95 shadow-xs backdrop-blur-sm">
						<Tooltip.Root>
							<Tooltip.Trigger>
								{#snippet child({ props })}
									<Button
										{...props}
										variant={cursorMode === 'interact' ? 'default' : 'ghost'}
										size="sm"
										onclick={() => setCursorMode('interact')}
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
										variant={cursorMode === 'pan' ? 'default' : 'ghost'}
										size="sm"
										onclick={() => setCursorMode('pan')}
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
											variant={cursorMode === 'select' ? 'default' : 'ghost'}
											size="sm"
											onclick={() => setCursorMode('select')}
										>
											<Square class="w-4 h-4" />
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
											variant={cursorMode === 'paint' ? 'default' : 'ghost'}
											size="sm"
											onclick={() => setCursorMode('paint')}
											class="relative"
										>
											<Paintbrush class="w-4 h-4" />
											{#if cursorMode === 'paint'}
												<span
													class="absolute -top-1 -right-1 flex h-3 w-3 items-center justify-center rounded-full text-xs {paintMode ===
													'add'
														? 'bg-green-500'
														: 'bg-red-500'}"
												>
													{#if paintMode === 'add'}
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
									Paint Mode - {paintMode === 'add' ? 'Add' : 'Remove'} tiles (size {brushSize})
								</Tooltip.Content>
							</Tooltip.Root>
						{/if}
					</div>
				</div>
			</div>

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
									<Badge variant="secondary">{tileState.pending.length}</Badge>
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
										Save {tileState.pending.length} Changes Now
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

						{#if tileState.currentPosition}
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

					<!-- Logout -->
					<div>
						<form action="?/logout" method="POST" class="contents">
							<Button variant="outline" size="sm" type="submit" class="w-full">Logout</Button>
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

<style>
	:global(body) {
		margin: 0;
		padding: 0;
		overflow: hidden;
	}
</style>

