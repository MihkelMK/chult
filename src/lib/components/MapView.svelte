<script lang="ts">
	import MapCanvasWrapper from '$lib/components/canvas/MapCanvasWrapper.svelte';
	import ConfirmDialog from '$lib/components/dialogs/ConfirmDialog.svelte';
	import ContextMenu from '$lib/components/dialogs/ContextMenu.svelte';
	import KeyboardShortcutsDialog from '$lib/components/dialogs/KeyboardShortcutsDialog.svelte';
	import MarkerCreateDialog from '$lib/components/dialogs/MarkerCreateDialog.svelte';
	import MarkerDetailsDialog from '$lib/components/dialogs/MarkerDetailsDialog.svelte';
	import MarkerPreviewPopover from '$lib/components/dialogs/MarkerPreviewPopover.svelte';
	import TimeCostDialog from '$lib/components/dialogs/TimeCostDialog.svelte';
	import CampaignSidebar from '$lib/components/map/CampaignSidebar.svelte';
	import LayerControls from '$lib/components/map/overlays/LayerControls.svelte';
	import SelectionToolbar from '$lib/components/map/overlays/SelectionToolbar.svelte';
	import ToolModeButtons from '$lib/components/map/overlays/ToolModeButtons.svelte';
	import ZoomControls from '$lib/components/map/overlays/ZoomControls.svelte';
	import SessionSidebar from '$lib/components/map/SessionSidebar.svelte';
	import MapEmpty from '$lib/components/placeholders/MapEmpty.svelte';
	import { Sheet } from '$lib/components/ui/sheet';
	import * as Tooltip from '$lib/components/ui/tooltip';
	import { getLocalState, getRemoteState } from '$lib/contexts/campaignContext';
	import type {
		DialogConfig,
		HexTriggerEvent,
		MarkerType,
		RightClickEvent,
		RightClickEventType,
		SelectMode,
		TileCoords,
		UITool,
		UIToolDM,
		UIToolPlayer,
		UserRole
	} from '$lib/types';
	import type { MapMarkerResponse } from '$lib/types/database';
	import { PressedKeys, Previous } from 'runed';
	import { toast } from 'svelte-sonner';
	import { expoIn, expoOut } from 'svelte/easing';
	import { SvelteSet } from 'svelte/reactivity';
	import { fly } from 'svelte/transition';
	import type { PageData } from '../../routes/(campaign)/[slug]/$types';
	import TopBar from './map/TopBar.svelte';

	interface Props {
		data: PageData;
		userRole: UserRole;
		effectiveRole: UserRole;
	}

	let { data, userRole, effectiveRole }: Props = $props();

	const zoomSteps = [1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5, 5.5, 6, 6.5, 7, 7.5, 8, 8.5, 9, 9.5, 10];

	const heldKeyboardKeys = new PressedKeys();

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
	let dialogConfig = $state<DialogConfig>({ title: '', description: '', actions: [] });

	// Context menu state
	let contextMenuOpen = $state(false);
	let contextMenuPosition = $state({ x: 0, y: 0 });
	let contextMenuType = $state<RightClickEventType | null>(null);

	// Marker dialog state
	let showCreateMarkerDialog = $state(false);
	let showEditMarkerDialog = $state(false);
	let showMarkerDetailsDialog = $state(false);
	let createMarkerCoords = $state<TileCoords | null>(null);
	let selectedMarker = $state<MapMarkerResponse | null>(null);
	let selectedDMMarker = $state<MapMarkerResponse | null>(null);
	let selectedPlayerMarker = $state<MapMarkerResponse | null>(null);

	// Marker hover tooltip state
	let hoveredMarker = $state<MapMarkerResponse | null>(null);
	let tooltipPosition = $state({ x: 0, y: 0 });

	let visiblePathSessions = new SvelteSet<number>(
		localState.activeSession ? [localState.activeSession.id] : []
	);

	// Teleport state
	let teleportMode = $state<'selecting-destination' | null>(null);
	let teleportOrigin = $state<TileCoords | null>(null);
	let showTimeCostDialog = $state(false);
	let pendingTeleportDestination = $state<TileCoords | null>(null);

	// Keyboard capture - disabled when any dialog or sidebar is open
	let shouldCaptureKeyboard = $derived(
		!leftSidebarOpen &&
			!rightSidebarOpen &&
			!showDialog &&
			!showTimeCostDialog &&
			!showCreateMarkerDialog &&
			!showEditMarkerDialog &&
			!showMarkerDetailsDialog
	);

	let shiftHeld = $derived(shouldCaptureKeyboard && heldKeyboardKeys.has('Shift'));
	let ctrlHeld = $derived(shouldCaptureKeyboard && heldKeyboardKeys.has('Control'));

	// Pan to tile state
	let panToCoords = $state<TileCoords | null>(null);

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
	let showDMMarkers = $state(true); // DM only: show hidden markers
	let showPlayerMarkers = $state(true); // DM only: show visible markers
	let tileTransparency = $state('1'); // 0 = transparent, 1 = opaque

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
			if (zoomIndex % 2 == 1) {
				zoomIndex += 1;
			} else {
				zoomIndex += 2;
			}
		}
	}

	function zoomOut() {
		if (zoomIndex > 0) {
			if (zoomIndex % 2 == 1) {
				zoomIndex -= 1;
			} else {
				zoomIndex -= 2;
			}
		}
	}

	function resetZoom() {
		zoomIndex = 0;
	}

	function handleZoomIn() {
		if (zoomIndex < zoomSteps.length - 1) {
			zoomIndex += 1;
		}
	}

	function handleZoomOut() {
		if (zoomIndex > 0) {
			zoomIndex -= 1;
		}
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

			case 'KeyE':
				event.preventDefault();
				setSelectedTool('explore');
				break;
		}
	}

	// Cursor mode functions
	function setSelectedTool(tool: UITool) {
		const dmOnly = ['select', 'paint', 'set-position'] satisfies UIToolDM[];
		const playerOnly = ['explore'] satisfies UIToolPlayer[];

		if (effectiveRole === 'player' && dmOnly.includes(tool as UIToolDM)) {
			return;
		}
		if (effectiveRole === 'dm' && playerOnly.includes(tool as UIToolPlayer)) {
			return;
		}

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
			description: `Move to tile ${tileKey.replace('-', '')}? This will take 0.5 days.`,
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

	function confirmDeleteMarker() {
		dialogConfig = {
			title: 'Delete Token?',
			description: `Are you sure you want to delete this token? It can not be undone.`,
			actions: [
				{
					label: 'Cancel',
					variant: 'outline',
					action: () => {}
				},
				{
					label: 'Delete',
					variant: 'destructive',
					action: () => handleDeleteMarker()
				}
			]
		};
		showDialog = true;
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
		// Allow both DM and players for marker creation and marker context menu
		// Only DM can use other context menus (teleport, etc.)
		if (effectiveRole !== 'dm' && event.type !== 'tile' && event.type !== 'marker') return;

		// If menu is already open, close it first to restore pointer events
		// Then reopen at new position on next tick
		const wasOpen = contextMenuOpen;
		if (wasOpen) {
			contextMenuOpen = false;
		}

		contextMenuPosition = { x: event.screenX, y: event.screenY };
		contextMenuType = event.type;

		// Store coords and lookup markers at tile (O(1) lookup)
		if (event.coords) {
			createMarkerCoords = event.coords;

			// Check for markers at this tile
			const tileKey = `${event.coords.x}-${event.coords.y}`;
			const markersAtTile = localState.markersByTile.get(tileKey);

			if (event.type === 'marker' && event.markers) {
				// Direct marker click - use the provided marker
				if (event.markers.dm) {
					selectedDMMarker = event.markers.dm;
				}
				if (event.markers.player) {
					selectedPlayerMarker = event.markers.player;
				}
			} else {
				// Tile right-click - check for both DM and player markers
				selectedDMMarker = null;
				selectedDMMarker = null;
			}

			// Store markers for context menu
			selectedDMMarker = markersAtTile?.dm || null;
			selectedPlayerMarker = markersAtTile?.player || null;
		}

		// Open menu on next tick to ensure state updates properly
		if (wasOpen) {
			setTimeout(() => {
				contextMenuOpen = true;
			}, 0);
		} else {
			contextMenuOpen = true;
		}
	}

	// Marker creation
	function openCreateMarkerDialog() {
		if (createMarkerCoords) {
			showCreateMarkerDialog = true;
			contextMenuOpen = false;
		}
	}

	async function handleCreateMarker(data: {
		type: MarkerType;
		title: string;
		content?: string;
		visibleToPlayers: boolean;
	}) {
		if (!createMarkerCoords) return;
		if (!('createMarker' in remoteState)) return;

		try {
			await remoteState.createMarker({
				x: createMarkerCoords.x,
				y: createMarkerCoords.y,
				type: data.type,
				title: data.title,
				content: data.content || null,
				authorRole: effectiveRole,
				visibleToPlayers: data.visibleToPlayers,
				imagePath: null
			});

			toast.success(`Marker "${data.title}" created`);
		} catch (error) {
			console.error('Failed to create marker:', error);
			const errorMessage = error instanceof Error ? error.message : 'Failed to create marker';
			toast.error(errorMessage);
		}
	}

	function handleCancelCreateMarker() {
		showCreateMarkerDialog = false;
		createMarkerCoords = null;
	}

	// Marker interaction handlers
	function handleMarkerHover(marker: MapMarkerResponse | null, screenX: number, screenY: number) {
		hoveredMarker = marker;
		if (marker) {
			tooltipPosition = { x: screenX + 10, y: screenY + 10 };
		}
	}

	function handleMarkerClick(marker: MapMarkerResponse) {
		// Party markers don't have a details dialog - only hover tooltip and context menu
		if (marker.type === 'party') return;

		selectedMarker = marker;
		showMarkerDetailsDialog = true;
	}

	function handleEditMarker() {
		if (selectedMarker) {
			showMarkerDetailsDialog = false;
			showEditMarkerDialog = true;
		}
	}

	async function handleUpdateMarker(data: {
		type: MarkerType;
		title: string;
		content?: string;
		visibleToPlayers: boolean;
	}) {
		if (!selectedMarker || !('updateMarker' in remoteState)) return;

		try {
			await remoteState.updateMarker(selectedMarker.id, data);
			toast.success('Marker updated');
			showEditMarkerDialog = false;
		} catch (error) {
			console.error('Failed to update marker:', error);
			const errorMessage = error instanceof Error ? error.message : 'Failed to update marker';
			toast.error(errorMessage);
		}
	}

	async function handleDeleteMarker() {
		if (!selectedMarker || !('deleteMarker' in remoteState)) return;

		try {
			await remoteState.deleteMarker(selectedMarker.id);
			toast.success('Marker deleted');
			showMarkerDetailsDialog = false;
			selectedMarker = null;
		} catch (error) {
			console.error('Failed to delete marker:', error);
			const errorMessage = error instanceof Error ? error.message : 'Failed to delete marker';
			toast.error(errorMessage);
		}
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

		setSelectedTool('set-position');
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

	function handlePanToParty() {
		if (localState.partyTokenPosition) {
			// Trigger pan by setting the tile coordinates
			panToCoords = { ...localState.partyTokenPosition };
			// Reset after a short delay to allow re-triggering
			setTimeout(() => {
				panToCoords = null;
			}, 100);
		}
	}

	// Add global event listeners
	$effect(() => {
		document.addEventListener('keydown', handleKeyDown);

		return () => {
			document.removeEventListener('keydown', handleKeyDown);
		};
	});

	// Remove pointer-events blocking from body when context menu is open
	$effect(() => {
		if (contextMenuOpen) {
			// Use MutationObserver to continuously override pointer-events: none
			const observer = new MutationObserver(() => {
				if (document.body.style.pointerEvents === 'none') {
					document.body.style.pointerEvents = 'auto';
				}
			});

			observer.observe(document.body, {
				attributes: true,
				attributeFilter: ['style']
			});

			// Initial override
			document.body.style.pointerEvents = 'auto';

			return () => {
				observer.disconnect();
			};
		}
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
	<div class="fixed inset-0 flex bg-background">
		<!-- Map Container with native scroll -->
		<div
			class="max-w-screen flex-1 overflow-auto bg-muted/20"
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
			{#if !data.mapUrls}
				<MapEmpty {userRole} slug={data.campaign.slug} />
			{:else}
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
					showDMMarkers={effectiveRole === 'dm' ? showDMMarkers : false}
					showPlayerMarkers={effectiveRole === 'dm' ? showPlayerMarkers : true}
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
					onMarkerHover={handleMarkerHover}
					onMarkerClick={handleMarkerClick}
					onZoomIn={handleZoomIn}
					onZoomOut={handleZoomOut}
					{activeTool}
					selectedTool={_selectedTool}
					{activeSelectMode}
					showAnimations={true}
					previewMode={false}
					{zoom}
					{showPaths}
					{visiblePathSessions}
					{panToCoords}
				/>
			{/if}
		</div>

		<!-- Top Bar with sidebar toggles -->
		<TopBar
			{hasErrors}
			{effectiveRole}
			campaignName={data.campaign?.name || data.session?.campaignSlug}
			activeSession={localState.activeSession}
			selectedCount={selectedSet.size}
			showSelectedCount={_selectedTool === 'select' || _selectedTool === 'paint'}
			partyTokenPosition={localState.partyTokenPosition}
			onOpenCampaign={() => (leftSidebarOpen = true)}
			onOpenHistory={() => (rightSidebarOpen = true)}
			onPanToParty={handlePanToParty}
		/>

		<!-- DM Selection/Paint Toolbar (only when in select or paint mode) -->
		{#if effectiveRole === 'dm' && (_selectedTool === 'select' || _selectedTool === 'paint')}
			<div
				in:fly={{ y: 100, easing: expoOut, duration: 500 }}
				out:fly={{ y: 100, easing: expoIn, duration: 250 }}
				class="absolute bottom-16 left-1/2 z-20 -translate-x-1/2"
			>
				<SelectionToolbar
					{activeSelectMode}
					bind:alwaysRevealMode
					bind:selectedSelectMode={_selectedSelectMode}
					bind:brushSize
					selectedCount={selectedSet.size}
					showBrushSize={activeTool === 'paint'}
					onReveal={revealSelectedTiles}
					onHide={hideSelectedTiles}
					onClear={() => clearSelection()}
				/>
			</div>
		{/if}

		<!-- Zoom Controls -->
		<div class="absolute right-4 bottom-4 z-20">
			<ZoomControls {zoom} onZoomIn={zoomIn} onZoomOut={zoomOut} onResetZoom={resetZoom} />
		</div>

		<!-- Keyboard Shortcuts Button -->
		<div class="absolute right-6 bottom-36 z-20 -mr-px">
			<KeyboardShortcutsDialog {effectiveRole} />
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

		<!-- Layer Controls -->
		{#if effectiveRole === 'dm'}
			<div class="absolute bottom-4 left-4 z-20">
				<LayerControls
					bind:showAlwaysRevealed
					bind:showRevealed
					bind:showUnrevealed
					bind:showPaths
					bind:showDMMarkers
					bind:showPlayerMarkers
					{tileTransparency}
					onTransparencyChange={(value) => (tileTransparency = value)}
				/>
			</div>
		{/if}

		<!-- Left Sidebar - Campaign Management -->
		<Sheet bind:open={leftSidebarOpen}>
			<CampaignSidebar
				bind:showDialog
				bind:dialogConfig
				{effectiveRole}
				{userRole}
				{hasActiveSession}
				{sessionDuration}
				campaignSlug={data.campaign.slug}
				globalGameTime={localState.globalGameTime}
				revealedTilesCount={localState.revealedTilesSet.size}
				alwaysRevealedTilesCount={localState.alwaysRevealedTilesSet.size}
				timeAuditLog={localState.timeAuditLog}
				hasPendingOperations={!!hasPendingOperations}
				pendingCount={remoteState.pending?.length || 0}
				activeSession={localState.activeSession}
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
				activeSessionDuration={sessionDuration}
				globalGameTime={localState.globalGameTime}
				onToggleVisibility={handleTogglePathVisibility}
			/>
		</Sheet>
	</div>

	<!-- Tile Right Click Menu -->
	<ContextMenu
		open={contextMenuOpen}
		position={contextMenuPosition}
		type={contextMenuType}
		partyPosition={localState.partyTokenPosition}
		tile={createMarkerCoords}
		{userRole}
		{selectedDMMarker}
		{selectedPlayerMarker}
		handleShowMarker={handleMarkerClick}
		{openCreateMarkerDialog}
		{startTeleport}
	/>

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

	<!-- Create Marker Dialog -->
	<MarkerCreateDialog
		bind:open={showCreateMarkerDialog}
		coords={createMarkerCoords}
		isDM={userRole === 'dm'}
		onConfirm={handleCreateMarker}
		onCancel={handleCancelCreateMarker}
	/>

	<!-- Edit Marker Dialog -->
	<MarkerCreateDialog
		bind:open={showEditMarkerDialog}
		coords={selectedMarker ? { x: selectedMarker.x, y: selectedMarker.y } : null}
		editingMarker={selectedMarker}
		isDM={userRole === 'dm'}
		onConfirm={handleUpdateMarker}
		onCancel={() => (showEditMarkerDialog = false)}
	/>

	<!-- Marker Details Dialog -->
	<MarkerDetailsDialog
		bind:open={showMarkerDetailsDialog}
		marker={selectedMarker}
		userRole={effectiveRole}
		canEdit={effectiveRole === 'dm' ||
			(!!selectedMarker && selectedMarker.authorRole === effectiveRole)}
		onEdit={handleEditMarker}
		onDelete={confirmDeleteMarker}
		onClose={() => {
			showMarkerDetailsDialog = false;
			selectedMarker = null;
		}}
	/>

	<!-- Marker Hover Tooltip -->
	<MarkerPreviewPopover {hoveredMarker} {effectiveRole} {tooltipPosition} />
</Tooltip.Provider>
