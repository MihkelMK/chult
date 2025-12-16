import type { LocalState } from '$lib/stores/localState.svelte';
import type {
	GameSessionResponse,
	MapMarkerResponse,
	Path,
	RevealedTileResponse
} from '$lib/types/database';
import type { ImageVariant, MapUrlsResponse } from '$lib/types/imgproxy';
import type { SvelteMap, SvelteSet } from 'svelte/reactivity';

export * from '$lib/types/database';
export * from '$lib/types/imgproxy';

export interface TileCoords {
	x: number;
	y: number;
}

export interface Hex {
	id: string;
	row: number;
	col: number;
	centerX: number;
	centerY: number;
}

export interface HexTriggerEvent {
	key: string;
}

export type RightClickEventType = 'tile' | 'token' | 'marker' | 'poi';

export interface RightClickEvent {
	type: RightClickEventType;
	key?: string; // For tiles
	coords?: TileCoords; // For anything with position
	markers?: { dm?: MapMarkerResponse; player?: MapMarkerResponse }; // For markers (O(1) lookup from background layer)
	screenX: number; // Screen X position for menu
	screenY: number; // Screen Y position for menu
}

export interface CanvasImage {
	image: HTMLImageElement | undefined;
	status: 'loading' | 'loaded' | 'failed';
}

export type UIToolGeneric = 'interact' | 'pan';
export type UIToolPlayer = 'explore';
export type UIToolDM = 'select' | 'paint' | 'set-position';
export type UITool = UIToolGeneric | UIToolDM | UIToolPlayer;
export type SelectMode = 'add' | 'remove';

export type MarkerType =
	| 'settlement' // Cities, towns, villages
	| 'dungeon' // Dungeons, caves, lairs
	| 'ruins' // Ruins, abandoned structures
	| 'rest' // Camps, inns, safe havens
	| 'landmark' // Notable locations, features
	| 'danger' // Hazards, threats
	| 'warning' // Caution areas
	| 'generic' // General marker
	| 'custom'; // Custom uploaded icon

export interface DialogAction {
	label: string;
	variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link';
	action: () => void;
}

export interface DialogConfig {
	title: string;
	description: string;
	actions: DialogAction[];
}

interface MapCanvasSharedProps {
	isDM?: boolean;
	isDragging: boolean;
	previewMode: boolean;
	canvasHeight: number;
	canvasWidth: number;
	imageHeight: number;
	imageWidth: number;
	hexesPerRow: number; // Number of hexagons per row on the actual map
	hexesPerCol: number; // Number of hexagons per column on the actual map
	xOffset: number; // Horizontal offset in pixels from left edge to where grid starts
	yOffset: number; // Vertical offset in pixels from top edge to where grid starts
	zoom: number;
	tileTransparency?: number;
	showAnimations: boolean;
	showAlwaysRevealed?: boolean;
	showRevealed?: boolean;
	showUnrevealed?: boolean;
	showDMMarkers?: boolean; // DM only: show hidden markers
	showPlayerMarkers?: boolean; // DM only: show visible markers
	showCoords: 'never' | 'always' | 'hover';
	activeTool: UITool;
	selectedTool: UITool;
	activeSelectMode: SelectMode;
	onHexTriggered: (event: HexTriggerEvent) => void;
	onRightClick?: (event: RightClickEvent) => void;
	onZoomIn?: () => void;
	onZoomOut?: () => void;
	onMarkerHover?: (marker: MapMarkerResponse | null, screenX: number, screenY: number) => void;
	onMarkerClick?: (marker: MapMarkerResponse) => void;
	onMapLoad?: (dimensions: { width: number; height: number }) => void;
	onMapError?: () => void;
}

export interface MapCanvasWrapperProps extends MapCanvasSharedProps {
	mapUrls: MapUrlsResponse;
	variant?: ImageVariant;
	initiallyRevealed?: RevealedTileResponse[];
	localState: LocalState;
	selectedSet: SvelteSet<string>;
	showPaths?: boolean;
	visiblePathSessions?: Set<number>;
	panToCoords?: TileCoords | null;
}

export interface MapCanvasProps extends MapCanvasSharedProps {
	image: HTMLImageElement | undefined;
	hexRadius: number;
	hexHeight: number;
	horizontalSpacing: number;
	verticalSpacing: number;
	revealedTiles: readonly Hex[];
	alwaysRevealedTiles: readonly Hex[];
	unrevealedTiles: readonly Hex[];
	selectedTiles: readonly Hex[];
	adjacentTiles: readonly Hex[]; // Valid moves with explore tool
	partyTokenTile: Hex | null;
	markerTiles?: ReadonlyArray<{
		dmMarker?: MapMarkerResponse;
		playerMarker?: MapMarkerResponse;
		tile: Hex;
	}>;
	markersByTile: SvelteMap<string, { dm?: MapMarkerResponse; player?: MapMarkerResponse }>; // For O(1) marker lookup on right-click (key: "x-y")
	showPaths?: boolean;
	visiblePathSessions?: Set<number>;
	sessions: GameSessionResponse[];
	pathsMap: SvelteMap<number, Path>;
	hexGrid: readonly Hex[];
	panToTile?: Hex | null;
}
