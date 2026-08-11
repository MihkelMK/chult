import type { LocalState } from '$lib/stores/localState.svelte';
import type { Hex, HexTriggerEvent, RightClickEvent, TileCoords } from '$lib/types/canvas';
import type { GameSessionResponse, MapMarkerResponse, Path, RevealedTileResponse } from '$lib/types/database';
import type { ImageVariant, MapUrlsResponse } from '$lib/types/imgproxy';
import type { SelectMode, UITool } from '$lib/types/ui';
import type { SvelteMap, SvelteSet } from 'svelte/reactivity';

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
  showPaths?: boolean;
  visiblePathSessions?: Set<number>;
  sessions: GameSessionResponse[];
  pathsMap: SvelteMap<number, Path>;
  hexGrid: readonly Hex[];
  panToTile?: Hex | null;
}
