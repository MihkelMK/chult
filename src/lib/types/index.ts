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
