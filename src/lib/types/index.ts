import type { CampaignState } from '$lib/stores/campaignState.svelte';
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

export interface HexRevealedEvent {
	hex: Hex;
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

interface MapCanvasSharedProps {
	isDM?: boolean;
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
	cursorMode: 'interact' | 'pan' | 'select' | 'paint';
	onHexRevealed: (event: HexRevealedEvent) => void;
	onHexHover: (coords: TileCoords | null) => void;
	onMapLoad?: (dimensions: { width: number; height: number }) => void;
	onMapError?: () => void;
	hasPoI: (coords: TileCoords) => boolean;
	hasNotes: (coords: TileCoords) => boolean;
	isPlayerPosition: (coords: TileCoords) => boolean;
}

export interface MapCanvasWrapperProps extends MapCanvasSharedProps {
	mapUrls: MapUrlsResponse;
	variant?: ImageVariant;
	initiallyRevealed?: RevealedTileResponse[];
	selectedTiles?: TileCoords[];
	campaignState: CampaignState;
}

export interface MapCanvasProps extends MapCanvasSharedProps {
	image: HTMLImageElement | undefined;
	hexGrid: readonly Hex[];
	hexRadius: number;
	selectedSet: SvelteSet<string>;
	revealedSet: SvelteSet<string>;
	alwaysRevealedSet: SvelteSet<string>;
}
