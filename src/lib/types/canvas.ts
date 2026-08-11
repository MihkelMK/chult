export interface HexCoordinates {
  col: number;
  row: number;
}

export interface HexPosition {
  centerX: number;
  centerY: number;
}

export interface Hex extends HexCoordinates, HexPosition {
  id: string;
}

export interface TileCoords {
  x: number;
  y: number;
}

export interface PixelPoint {
  x: number;
  y: number;
}

export interface HexTriggerEvent {
  key: string;
}

export type RightClickEventType = 'tile' | 'marker';

export interface RightClickEvent {
  type: RightClickEventType;
  coords: TileCoords; // Tile the click resolved to
  screenX: number; // Screen X position for menu
  screenY: number; // Screen Y position for menu
}

export interface CanvasImage {
  image: HTMLImageElement | undefined;
  status: 'loading' | 'loaded' | 'failed';
}
