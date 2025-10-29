<script lang="ts">
	import ConfirmDialog from '$lib/components/general/ConfirmDialog.svelte';
	import TimeCostDialog from '$lib/components/general/TimeCostDialog.svelte';
	import CampaignSidebar from '$lib/components/map/CampaignSidebar.svelte';
	import MapCanvasWrapper from '$lib/components/map/canvas/MapCanvasWrapper.svelte';
	import MainToolbar from '$lib/components/map/MainToolbar.svelte';
	import LayerControls from '$lib/components/map/overlays/LayerControls.svelte';
	import SelectionToolbar from '$lib/components/map/overlays/SelectionToolbar.svelte';
	import ToolModeButtons from '$lib/components/map/overlays/ToolModeButtons.svelte';
	import ZoomControls from '$lib/components/map/overlays/ZoomControls.svelte';
	import SessionSidebar from '$lib/components/map/SessionSidebar.svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu';
	import * as Empty from '$lib/components/ui/empty/index.js';
	import { Sheet } from '$lib/components/ui/sheet';
	import * as Tooltip from '$lib/components/ui/tooltip';
	import { getLocalState, getRemoteState } from '$lib/contexts/campaignContext';
	import type {
		HexTriggerEvent,
		RightClickEvent,
		RightClickEventType,
		SelectMode,
		TileCoords,
		UITool,
		UserRole
	} from '$lib/types';
	import { Map } from '@lucide/svelte';
	import { PressedKeys, Previous } from 'runed';
	import { toast } from 'svelte-sonner';
	import { expoIn, expoOut } from 'svelte/easing';
	import { SvelteSet } from 'svelte/reactivity';
	import { fly } from 'svelte/transition';
	import type { PageData } from '../../routes/(campaign)/[slug]/$types';

	interface Props {
		data: PageData;
		userRole: UserRole;
		effectiveRole: UserRole;
	}

	let { data, userRole, effectiveRole }: Props = $props();

	const zoomSteps = [1, 1.5, 2, 3, 4, 5, 6, 10];

	const heldKeyboardKeys = new PressedKeys();
	let shouldCaptureKeyboard = $state(true);

	let shiftHeld = $derived(shouldCaptureKeyboard && heldKeyboardKeys.has('Shift'));
	let ctrlHeld = $derived(shouldCaptureKeyboard && heldKeyboardKeys.has('Control'));

	// UI State
	let leftSidebarOpen = $state(false);
	let rightSidebarOpen = $state(false);

	// Get states from context
	const localState = getLocalState();
	const remoteState = getRemoteState();

	// Internal state to track what tool was selected
	let _selectedTool = $state<UITool>('interact');
	let _selectedSelectMode = $state<SelectMode>('add');

	// Exploration state
	let showDialog = $state(false);
	let dialogConfig = $state<{
		title: string;
		description: string;
		actions: Array<{
			label: string;
			variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link';
			action: () => void;
		}>;
	}>({ title: '', description: '', actions: [] });

	// Context menu state
	let contextMenuOpen = $state(false);
	let contextMenuPosition = $state({ x: 0, y: 0 });
	let contextMenuType = $state<RightClickEventType | null>(null);
	// let contextMenuData = $state<any>(null);

	let visiblePathSessions = new SvelteSet<number>(
		localState.activeSession ? [localState.activeSession.id] : []
	);

	// Teleport state
	let teleportMode = $state<'selecting-destination' | null>(null);
	let teleportOrigin = $state<TileCoords | null>(null);
	let showTimeCostDialog = $state(false);
	let pendingTeleportDestination = $state<TileCoords | null>(null);

	// Use these values to determine actual expected action
	let activeTool = $derived(shiftHeld ? 'pan' : _selectedTool);
	let activeSelectMode = $derived<SelectMode>(
		!ctrlHeld ? _selectedSelectMode : _selectedSelectMode === 'add' ? 'remove' : 'add'
	);

	let loading = $state(false);
	let brushSize = $state<number>(3); // Brush radius (1-5)
	let alwaysRevealMode = $state(false);
	let showAlwaysRevealed = $state(false);
	let showRevealed = $state(false);
	let showUnrevealed = $state(true);
	let showPaths = $state(true);
	let tileTransparency = $state('1'); // 0 = transparent, 1 = opaque
	let layerVisibilityOpen = $state(false);

	let canvasWidth = $state(0);
	let canvasHeight = $state(0);
	let zoomIndex = $state(0);
	let zoom = $derived(zoomSteps[zoomIndex]);

	let isDragging = $state(false);
	let previousIsDragging = new Previous(() => isDragging);

	let selectedSet = new SvelteSet<string>();
	let selectionHistory = $state<SvelteSet<string>[]>([new SvelteSet<string>()]);
	let historyIndex = $state(0);

	function areSetsEqual(a: SvelteSet<string>, b: SvelteSet<string>): boolean {
		if (a.size !== b.size) return false;
		for (const item of a) if (!b.has(item)) return false;
		return true;
	}

	function saveSelectionState() {
		// Only save if selection actually changed
		const last = selectionHistory[historyIndex];

		if (!last || !areSetsEqual(selectedSet, last)) {
			const current = new SvelteSet(selectedSet);
			selectionHistory = selectionHistory.slice(0, historyIndex + 1);
			selectionHistory.push(current);
			historyIndex++;

			// Keep last 50 states
			if (selectionHistory.length > 50) {
				selectionHistory.shift();
				historyIndex--;
			}
		}
	}

	function undoSelection() {
		if (historyIndex > 0) {
			historyIndex--;
			const historicalSet = selectionHistory[historyIndex];
			selectedSet.clear();
			for (const item of historicalSet) {
				selectedSet.add(item);
			}
		}
	}

	function redoSelection() {
		if (historyIndex < selectionHistory.length - 1) {
			historyIndex++;
			const historicalSet = selectionHistory[historyIndex];
			selectedSet.clear();
			for (const item of historicalSet) {
				selectedSet.add(item);
			}
		}
	}

	let hasPendingOperations = $derived(
		effectiveRole === 'dm' && remoteState.pending && remoteState.pending.length > 0
	);

	let hasErrors = $derived(
		effectiveRole === 'dm' &&
			'errors' in remoteState &&
			remoteState.errors &&
			remoteState.errors.length > 0
	);

	// Exploration derived state
	let hasActiveSession = $derived(localState.activeSession !== null);
	let canExplore = $derived(hasActiveSession && localState.partyTokenPosition !== null);

	// Current session duration (updates every second when session is active)
	let currentTime = $state(Date.now());
	let sessionDuration = $derived.by(() => {
		if (!localState.activeSession) return null;

		const startTime = new Date(localState.activeSession.startedAt).getTime();
		const elapsed = (currentTime - startTime) / 1000; // seconds

		const hours = Math.floor(elapsed / 3600);
		const minutes = Math.floor((elapsed % 3600) / 60);
		const seconds = Math.floor(elapsed % 60);

		if (hours > 0) {
			return `${hours}h ${minutes}m ${seconds}s`;
		} else if (minutes > 0) {
			return `${minutes}m ${seconds}s`;
		} else {
			return `${seconds}s`;
		}
	});

	// Update current time every second when session is active
	$effect(() => {
		if (hasActiveSession) {
			const interval = setInterval(() => {
				currentTime = Date.now();
			}, 1000);

			return () => clearInterval(interval);
		}
	});

	function getBrushTiles(centerTile: string): string[] {
		const tileKeys: string[] = [];
		const radius = brushSize - 1; // Convert size to radius (size 1 = radius 0, size 5 = radius 4)

		const [centerCol, centerRow] = centerTile.split('-').map(Number);
		// Flip col/row because the hex grid is rotated 90deg when rendered
		const maxRow = (data.campaign?.hexesPerCol ?? 20) - 1;
		const maxCol = (data.campaign?.hexesPerRow ?? 20) - 1;

		// Convert center to axial coordinates (odd-q offset)
		const centerQ = centerCol; // col is q in axial
		const centerR = centerRow - (centerCol - (centerCol & 1)) / 2;

		for (let dx = -radius; dx <= radius; dx++) {
			for (let dy = -radius; dy <= radius; dy++) {
				const col = centerCol + dx;
				const row = centerRow + dy;

				// Bounds check first (early exit)
				if (col < 0 || col > maxCol || row < 0 || row > maxRow) {
					continue;
				}

				// Convert target to axial coordinates (odd-q offset)
				const q = col; // col is q
				const r = row - (col - (col & 1)) / 2; // row adjusted by col offset

				// Calculate hexagonal distance in axial space
				const dq = q - centerQ;
				const dr = r - centerR;
				const hexDistance = (Math.abs(dq) + Math.abs(dq + dr) + Math.abs(dr)) / 2;

				if (hexDistance <= radius) {
					tileKeys.push(`${col}-${row}`);
				}
			}
		}

		return tileKeys;
	}

	function hasPoI(coords: TileCoords) {
		return localState.getTileMarkers(coords, effectiveRole).some((m) => m.type === 'poi');
	}

	function hasNotes(coords: TileCoords) {
		return localState.getTileMarkers(coords, effectiveRole).some((m) => m.type === 'note');
	}

	function clearSelection(clearHistory: boolean = true) {
		selectedSet.clear();

		if (clearHistory) {
			selectionHistory = [new SvelteSet<string>()];
			historyIndex = 0;
		} else {
			saveSelectionState();
		}
	}

	function handleSelect(key: string) {
		const isRevealed = localState.revealedTilesSet.has(key);
		const isAlwaysRevealed = localState.alwaysRevealedTilesSet.has(key);
		const isUnrevealed = !isRevealed && !isAlwaysRevealed;

		// Only select tiles from visible layers
		const canSelect =
			(isUnrevealed && showUnrevealed) ||
			(isRevealed && showRevealed) ||
			(isAlwaysRevealed && showAlwaysRevealed);

		if (!canSelect) {
			return;
		}

		// Return if tile selected and we want to add or if tile not selected and we want to remove
		if (selectedSet.has(key) === (activeSelectMode === 'add')) {
			return;
		}

		if (activeSelectMode === 'add') {
			selectedSet.add(key);
		} else {
			selectedSet.delete(key);
		}
	}

	// Event handlers based on cursor mode
	function handleTileTrigger(event: HexTriggerEvent) {
		const clickedKey = event.key;

		// Check if in teleport mode first
		if (teleportMode === 'selecting-destination') {
			handleTeleportDestinationClick(clickedKey);
			return;
		}

		switch (activeTool) {
			case 'interact':
				// TODO: open tile content modal
				break;
			case 'explore':
				// Player exploration mode - check if tile is adjacent and if there's an active session
				if (canExplore && isAdjacentToParty(clickedKey)) {
					showMovementConfirmation(clickedKey);
				} else if (!canExplore) {
					toast.error('Can only explore when in active session');
				} else if (!isAdjacentToParty(clickedKey)) {
					toast.error('Tile is not adjacent to party position');
				}
				break;
			case 'select':
				// Multi-select mode - toggle selection
				if (effectiveRole === 'dm') {
					handleSelect(clickedKey);
				}
				break;
			case 'paint':
				// Paint mode - paint multiple tiles based on brush size
				if (effectiveRole === 'dm') {
					const tilesToPaint = getBrushTiles(clickedKey);
					// Batch updates to the set for better performance
					for (const key of tilesToPaint) {
						const isRevealed = localState.revealedTilesSet.has(key);
						const isAlwaysRevealed = localState.alwaysRevealedTilesSet.has(key);
						const isUnrevealed = !isRevealed && !isAlwaysRevealed;

						// Only select tiles from visible layers
						const canSelect =
							(isUnrevealed && showUnrevealed) ||
							(isRevealed && showRevealed) ||
							(isAlwaysRevealed && showAlwaysRevealed);

						if (!canSelect) {
							continue;
						}

						// Return if tile selected and we want to add or if tile not selected and we want to remove
						if (selectedSet.has(key) === (activeSelectMode === 'add')) {
							continue;
						}

						if (activeSelectMode === 'add') {
							selectedSet.add(key);
						} else {
							selectedSet.delete(key);
						}
					}
				}
				break;
			case 'pan':
				// Pan mode - do nothing on tile click
				break;
		}
	}

	function getCoordsFromKey(key: string): TileCoords {
		const [x, y] = key.split('-').map(Number);
		return { x, y };
	}

	function getSelectedTileCoordsFromSet(selectedKeys: SvelteSet<string>): TileCoords[] {
		return Array.from(selectedKeys).map((key) => getCoordsFromKey(key));
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

		if (event.code === 'KeyZ' && event.ctrlKey) {
			if (event.shiftKey) {
				redoSelection();
			} else {
				undoSelection();
			}
			return;
		}

		switch (event.code) {
			case 'Escape':
				event.preventDefault();
				if (selectedSet.size > 0) {
					clearSelection(false);
				} else if (_selectedTool !== 'interact') {
					clearSelection(true);
					_selectedTool = 'interact';
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

	// Cursor mode functions
	function setSelectedTool(tool: UITool) {
		_selectedTool = tool;
		if (tool !== 'select' && tool !== 'paint') {
			clearSelection();
		}
	}

	// Movement confirmation and execution
	async function confirmMovement(tileKey: string) {
		if ('addPlayerMove' in remoteState) {
			try {
				await remoteState.addPlayerMove(tileKey);
				toast.success('Moved successfully');
			} catch (error) {
				console.error('Failed to move:', error);
				const errorMessage = error instanceof Error ? error.message : 'Failed to move';
				toast.error(errorMessage);
			}
		}
	}

	function showMovementConfirmation(tileKey: string) {
		dialogConfig = {
			title: 'Confirm Movement',
			description: `Move to tile ${tileKey}? This will take 0.5 days.`,
			actions: [
				{
					label: 'Cancel',
					variant: 'outline',
					action: () => {}
				},
				{
					label: 'Move',
					variant: 'default',
					action: () => confirmMovement(tileKey)
				}
			]
		};
		showDialog = true;
	}

	// Exploration functions
	async function handleStartSession() {
		if (effectiveRole === 'dm' && 'startSession' in remoteState) {
			try {
				await remoteState.startSession();
				toast.success('Session started');
			} catch (error) {
				console.error('Failed to start session:', error);
				toast.error('Failed to start session');
			}
		}
	}

	function showEndSessionConfirmation(sessionId: number, durationSeconds: number) {
		dialogConfig = {
			title: 'End Short Session?',
			description: `This session has only been active for ${Math.floor(durationSeconds)} seconds. Would you like to end it or delete it?`,
			actions: [
				{
					label: 'Cancel',
					variant: 'outline',
					action: () => {}
				},
				{
					label: 'Delete Session',
					variant: 'destructive',
					action: async () => {
						try {
							if ('deleteSession' in remoteState) {
								await remoteState.deleteSession(sessionId);
								toast.success('Session deleted');
							}
						} catch (error) {
							console.error('Failed to delete session:', error);
							toast.error('Failed to delete session');
						}
					}
				},
				{
					label: 'End Session',
					variant: 'default',
					action: async () => {
						try {
							if ('endSession' in remoteState) {
								await remoteState.endSession();
								toast.success('Session ended');
							}
						} catch (error) {
							console.error('Failed to end session:', error);
							toast.error('Failed to end session');
						}
					}
				}
			]
		};
		showDialog = true;
	}

	async function handleEndSession() {
		if (effectiveRole === 'dm' && 'endSession' in remoteState) {
			const activeSession = localState.activeSession;
			if (!activeSession) return;

			// Calculate session duration in minutes
			const now = new Date();
			const startTime = new Date(activeSession.startedAt);
			const durationMinutes = (now.getTime() - startTime.getTime()) / 60000;

			// If session is less than 1 minute, ask if they want to delete it
			if (durationMinutes < 1) {
				showEndSessionConfirmation(activeSession.id, durationMinutes * 60);
			} else {
				// Session is longer than 1 minute, end it directly
				try {
					await remoteState.endSession();
					toast.success('Session ended');
				} catch (error) {
					console.error('Failed to end session:', error);
					toast.error('Failed to end session');
				}
			}
		}
	}

	function isAdjacentToParty(tileKey: string): boolean {
		if (!localState.partyTokenPosition) return false;

		const [x, y] = tileKey.split('-').map(Number);
		const { x: partyX, y: partyY } = localState.partyTokenPosition;

		// Odd-q offset coordinates - calculate adjacent hexes
		const isOddCol = partyX % 2 === 1;
		const adjacentOffsets = isOddCol
			? [
					[0, -1],
					[1, 0],
					[1, 1],
					[0, 1],
					[-1, 1],
					[-1, 0]
				] // Odd column
			: [
					[0, -1],
					[1, -1],
					[1, 0],
					[0, 1],
					[-1, 0],
					[-1, -1]
				]; // Even column

		return adjacentOffsets.some(([dx, dy]) => partyX + dx === x && partyY + dy === y);
	}

	function revealSelectedTiles() {
		if (effectiveRole === 'dm' && 'revealTiles' in remoteState) {
			const selectedCoords = getSelectedTileCoordsFromSet(selectedSet);
			remoteState.revealTiles(selectedCoords, alwaysRevealMode);
			clearSelection();
		}
	}

	function hideSelectedTiles() {
		if (effectiveRole === 'dm' && 'hideTiles' in remoteState) {
			const selectedCoords = getSelectedTileCoordsFromSet(selectedSet);
			remoteState.hideTiles(selectedCoords);
			clearSelection();
		}
	}

	function flushPendingOperations() {
		if (effectiveRole === 'dm' && 'flush' in remoteState) {
			remoteState.flush();
		}
	}

	// Right-click handler
	function handleRightClick(event: RightClickEvent) {
		if (effectiveRole !== 'dm') return; // Only DM can use context menus

		contextMenuPosition = { x: event.screenX, y: event.screenY };
		contextMenuType = event.type;
		// contextMenuData = event.data;
		contextMenuOpen = true;
	}

	// Teleport functions
	function startTeleport() {
		if (!localState.partyTokenPosition) {
			toast.error('Cannot teleport: no party token position');
			return;
		}
		if (!hasActiveSession) {
			toast.error('Cannot teleport: no active session ');
			return;
		}

		teleportOrigin = localState.partyTokenPosition;
		teleportMode = 'selecting-destination';
		contextMenuOpen = false;
		toast.info('Click a tile to teleport the party');
	}

	function cancelTeleport() {
		teleportMode = null;
		teleportOrigin = null;
		pendingTeleportDestination = null;
	}

	function handleTeleportDestinationClick(tileKey: string) {
		const [x, y] = tileKey.split('-').map(Number);
		pendingTeleportDestination = { x, y };
		showTimeCostDialog = true;
	}

	async function confirmTeleport(timeCost: number) {
		if (!teleportOrigin || !pendingTeleportDestination) return;

		if ('addDMTeleport' in remoteState) {
			try {
				await remoteState.addDMTeleport(teleportOrigin, pendingTeleportDestination, timeCost);
				toast.success('Party teleported successfully');
			} catch (error) {
				console.error('Failed to teleport:', error);
				const errorMessage = error instanceof Error ? error.message : 'Failed to teleport';
				toast.error(errorMessage);
			}
		}

		// Reset teleport state
		showTimeCostDialog = false;
		cancelTeleport();
	}

	// Path visibility handlers
	function handleTogglePathVisibility(sessionId: number) {
		if (visiblePathSessions.has(sessionId)) {
			visiblePathSessions.delete(sessionId);
		} else {
			visiblePathSessions.add(sessionId);
		}
	}

	function handleOpenHistory() {
		rightSidebarOpen = true;
	}

	// Add global event listeners
	$effect(() => {
		document.addEventListener('keydown', handleKeyDown);

		return () => {
			document.removeEventListener('keydown', handleKeyDown);
		};
	});

	$effect(() => {
		// Save state only when dragging has just finished
		if (previousIsDragging.current && !isDragging) {
			saveSelectionState();
		}
	});
</script>

<svelte:window bind:innerWidth={canvasWidth} bind:innerHeight={canvasHeight} />

<!-- Full screen layout -->
<Tooltip.Provider>
	<div class="flex fixed inset-0 bg-background">
		<!-- Collapsible Sidebar -->
		<Sheet bind:open={leftSidebarOpen}>
			<div class="flex relative flex-col flex-1">
				<!-- Floating Toolbars -->
				<MainToolbar
					campaignName={data.campaign?.name || data.session?.campaignSlug}
					{effectiveRole}
					{hasErrors}
					activeSession={localState.activeSession}
					selectedCount={selectedSet.size}
					showSelectedCount={_selectedTool === 'select' || _selectedTool === 'paint'}
					partyTokenPosition={localState.partyTokenPosition}
					onOpenHistory={handleOpenHistory}
				/>

				<!-- DM Selection/Paint Toolbar (only when in select or paint mode) -->
				{#if effectiveRole === 'dm' && (_selectedTool === 'select' || _selectedTool === 'paint')}
					<div
						in:fly={{ y: 100, easing: expoOut, duration: 500 }}
						out:fly={{ y: 100, easing: expoIn, duration: 250 }}
						class="absolute bottom-16 left-1/2 z-20 -translate-x-1/2"
					>
						<SelectionToolbar
							{alwaysRevealMode}
							{activeSelectMode}
							selectedCount={selectedSet.size}
							showBrushSize={activeTool === 'paint'}
							{brushSize}
							onToggleAlwaysReveal={() => (alwaysRevealMode = !alwaysRevealMode)}
							onSetSelectMode={(mode) => (_selectedSelectMode = mode)}
							onReveal={revealSelectedTiles}
							onHide={hideSelectedTiles}
							onClear={() => clearSelection()}
							onBrushSizeChange={(size) => (brushSize = size)}
						/>
					</div>
				{/if}

				<!-- Zoom Controls -->
				<div class="absolute right-4 bottom-4 z-20">
					<ZoomControls {zoom} onZoomIn={zoomIn} onZoomOut={zoomOut} onResetZoom={resetZoom} />
				</div>

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
					{#if data.mapUrls}
						<MapCanvasWrapper
							bind:isDragging
							{canvasHeight}
							{canvasWidth}
							mapUrls={data.mapUrls}
							variant="detail"
							isDM={effectiveRole === 'dm'}
							showAlwaysRevealed={effectiveRole === 'dm' ? showAlwaysRevealed : false}
							showRevealed={effectiveRole === 'dm' ? showRevealed : false}
							showUnrevealed={effectiveRole === 'dm' ? showUnrevealed : true}
							tileTransparency={effectiveRole === 'dm' ? Number(tileTransparency) : 0.75}
							hexesPerRow={data.campaign?.hexesPerRow ?? 20}
							hexesPerCol={data.campaign?.hexesPerCol ?? 20}
							xOffset={data.campaign?.hexOffsetX ?? 70}
							yOffset={(data.campaign?.hexOffsetY ?? 58) - 2}
							imageHeight={data.campaign?.imageHeight}
							imageWidth={data.campaign?.imageWidth}
							{localState}
							{selectedSet}
							showCoords={effectiveRole === 'dm' ? 'always' : 'hover'}
							onHexTriggered={handleTileTrigger}
							onRightClick={handleRightClick}
							{hasPoI}
							{hasNotes}
							{activeTool}
							selectedTool={_selectedTool}
							{activeSelectMode}
							showAnimations={true}
							previewMode={false}
							{zoom}
							{showPaths}
							{visiblePathSessions}
						/>
					{:else}
						<div class="flex justify-center items-center h-full">
							<Empty.Root class="border border-dashed">
								<Empty.Header>
									<Empty.Media variant="icon">
										<Map />
									</Empty.Media>
									<Empty.Title>Map Not Available</Empty.Title>
									<Empty.Description>
										{#if userRole === 'dm'}
											Upload a map in the settings to get started.
										{:else}
											The campaign map is being prepared by your DM.
										{/if}
									</Empty.Description>
								</Empty.Header>
								<Empty.Content>
									<Button
										variant="outline"
										size="sm"
										href="/{data.campaign.slug}/settings"
										class="cursor-pointer">Go to settings</Button
									>
								</Empty.Content>
							</Empty.Root>
						</div>
					{/if}
				</div>

				<!-- Bottom Toolbar with Cursor Modes -->
				<div class="absolute bottom-4 left-1/2 z-20 -translate-x-1/2">
					<ToolModeButtons
						{activeTool}
						{activeSelectMode}
						{brushSize}
						showDMTools={effectiveRole === 'dm'}
						showExploreTool={effectiveRole === 'player'}
						onSelectTool={setSelectedTool}
					/>
				</div>

				<!-- General Confirmation Dialog -->
				<ConfirmDialog
					bind:open={showDialog}
					title={dialogConfig.title}
					description={dialogConfig.description}
					actions={dialogConfig.actions}
				/>
			</div>

			<!-- Layer Controls -->
			{#if effectiveRole === 'dm'}
				<div class="absolute bottom-4 left-4 z-20">
					<LayerControls
						{showAlwaysRevealed}
						{showRevealed}
						{showUnrevealed}
						{showPaths}
						{tileTransparency}
						isOpen={layerVisibilityOpen}
						onToggleAlwaysRevealed={() => (showAlwaysRevealed = !showAlwaysRevealed)}
						onToggleRevealed={() => (showRevealed = !showRevealed)}
						onToggleUnrevealed={() => (showUnrevealed = !showUnrevealed)}
						onTogglePaths={() => (showPaths = !showPaths)}
						onTransparencyChange={(value) => (tileTransparency = value)}
						onToggleOpen={(open) => (layerVisibilityOpen = open)}
					/>
				</div>
			{/if}

			<!-- Left Sidebar Content -->
			<CampaignSidebar
				{effectiveRole}
				{userRole}
				campaignSlug={data.campaign.slug}
				globalGameTime={localState.globalGameTime}
				revealedTilesCount={localState.revealedTilesSet.size}
				alwaysRevealedTilesCount={localState.alwaysRevealedTilesSet.size}
				hasPendingOperations={!!hasPendingOperations}
				pendingCount={remoteState.pending?.length || 0}
				{hasActiveSession}
				activeSession={localState.activeSession}
				{sessionDuration}
				onStartSession={handleStartSession}
				onEndSession={handleEndSession}
				onFlushPending={flushPendingOperations}
			/>
		</Sheet>

		<!-- Right Sidebar - Session History -->
		<Sheet bind:open={rightSidebarOpen}>
			<SessionSidebar
				sessions={localState.gameSessions}
				pathsMap={localState.pathsMap}
				activeSessionId={localState.activeSession?.id || null}
				visibleSessionIds={visiblePathSessions}
				onToggleVisibility={handleTogglePathVisibility}
			/>
		</Sheet>
	</div>

	<!-- Context Menu -->
	<div
		style="position: fixed; left: {contextMenuPosition.x}px; top: {contextMenuPosition.y}px; pointer-events: none; z-index: 9999;"
	>
		<DropdownMenu.Root bind:open={contextMenuOpen}>
			<DropdownMenu.Trigger style="pointer-events: auto;" />
			<DropdownMenu.Content style="pointer-events: auto;">
				{#if contextMenuType === 'token'}
					<DropdownMenu.Item onclick={startTeleport}>Teleport Party</DropdownMenu.Item>
				{/if}
			</DropdownMenu.Content>
		</DropdownMenu.Root>
	</div>

	<!-- Time Cost Dialog for Teleport -->
	<TimeCostDialog
		bind:open={showTimeCostDialog}
		title="Set Teleport Time Cost"
		description="How much game time should this teleport take?"
		defaultTimeCost={0}
		onConfirm={confirmTeleport}
		onCancel={() => {
			showTimeCostDialog = false;
			cancelTeleport();
		}}
	/>
</Tooltip.Provider>
