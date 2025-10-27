import type { LocalState } from '$lib/stores/localState.svelte';
import type { RevealedTileResponse } from '$lib/types/database';
import type { ImageVariant, MapUrlsResponse } from '$lib/types/imgproxy';
import type { SvelteSet } from 'svelte/reactivity';

export * from '$lib/types/database';
export * from '$lib/types/imgproxy';

export interface TileCoords {
	x: number;
	y: number;
}

/**
 * Interface for a compact coordinate range.
 * This stores a start and end x-coordinate for a given y-coordinate,
 * allowing for efficient representation of contiguous areas.
 */
export interface TileCoordsRange {
	yStart: number;
	yEnd: number;
	xStart: number;
	xEnd: number;
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
	screenX: number; // Screen X position for menu
	screenY: number; // Screen Y position for menu
	data?: any; // Additional context
}

export interface HexRendered extends Hex {
	fill: string;
	stroke: string;
	strokeWidth: string;
	strokeOpacity: string | number;
	class?: string;
	style?: string;
	poinerEvents?: string;
	fillOpacity: string | number;
	shouldRender: boolean;
}

export interface CanvasImage {
	image: HTMLImageElement | undefined;
	status: 'loading' | 'loaded' | 'failed';
}

export type UITool = 'interact' | 'pan' | 'select' | 'paint' | 'explore' | 'set-position';
export type SelectMode = 'add' | 'remove';

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
	showCoords: 'never' | 'always' | 'hover';
	activeTool: UITool;
	selectedTool: UITool;
	activeSelectMode: SelectMode;
	onHexTriggered: (event: HexTriggerEvent) => void;
	onRightClick?: (event: RightClickEvent) => void;
	onMapLoad?: (dimensions: { width: number; height: number }) => void;
	onMapError?: () => void;
	hasPoI: (coords: TileCoords) => boolean;
	hasNotes: (coords: TileCoords) => boolean;
}

export interface MapCanvasWrapperProps extends MapCanvasSharedProps {
	mapUrls: MapUrlsResponse;
	variant?: ImageVariant;
	initiallyRevealed?: RevealedTileResponse[];
	localState: LocalState;
	selectedSet: SvelteSet<string>;
}

export interface MapCanvasProps extends MapCanvasSharedProps {
	image: HTMLImageElement | undefined;
	hexRadius: number;
	revealedTiles: readonly Hex[];
	alwaysRevealedTiles: readonly Hex[];
	unrevealedTiles: readonly Hex[];
	selectedTiles: readonly Hex[];
	adjacentTiles: readonly Hex[]; // Valid moves with explore tool
	partyTokenTile: Hex | null;
}
