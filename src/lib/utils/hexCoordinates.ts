/**
 * Hex coordinate utilities for converting between pixel positions and hex grid coordinates.
 *
 * The hex grid uses odd-q offset coordinates with a 90° rotation:
 * - Hexagons are generated as pointy-top, then rotated 90° to flat-top
 * - Odd columns (q) are offset vertically by half a hex height
 * - Coordinate format: "col-row" where col=x, row=y
 */

export interface HexCoordinates {
	col: number;
	row: number;
}

/**
 * Converts pixel coordinates to hex grid coordinates (odd-q offset).
 *
 * This reverses the calculation from generateHexGrid():
 * - centerX = col * horizontalSpacing + hexRadius
 * - centerY = row * verticalSpacing + offsetY + hexHeight / 2
 * - offsetY = (col % 2) * (verticalSpacing * 0.5)
 *
 * @param pixelX - X coordinate in pixels (relative to grid origin)
 * @param pixelY - Y coordinate in pixels (relative to grid origin)
 * @param hexRadius - Radius of a single hexagon
 * @param hexHeight - Height of a single hexagon
 * @param horizontalSpacing - Horizontal spacing between hex centers (hexRadius * 1.5)
 * @param verticalSpacing - Vertical spacing between hex centers (hexHeight)
 * @param hexesPerRow - Total columns in the grid
 * @param hexesPerCol - Total rows in the grid
 * @returns Hex coordinates {col, row} or null if out of bounds
 */
export function pixelToHex(
	pixelX: number,
	pixelY: number,
	hexRadius: number,
	hexHeight: number,
	horizontalSpacing: number,
	verticalSpacing: number,
	hexesPerRow: number,
	hexesPerCol: number
): HexCoordinates | null {
	// Step 1: Estimate column from X position
	// centerX = col * horizontalSpacing + hexRadius
	// col ≈ (pixelX - hexRadius) / horizontalSpacing
	const estimatedCol = Math.round((pixelX - hexRadius) / horizontalSpacing);

	// Clamp to valid range
	if (estimatedCol < 0 || estimatedCol >= hexesPerRow) {
		return null;
	}

	// Step 2: Calculate the Y offset for this column
	// Odd columns are shifted down by half a hex height
	const isOddCol = estimatedCol % 2 === 1;
	const offsetY = isOddCol ? verticalSpacing * 0.5 : 0;

	// Step 3: Estimate row from Y position, accounting for column offset
	// centerY = row * verticalSpacing + offsetY + hexHeight / 2
	// row ≈ (pixelY - offsetY - hexHeight / 2) / verticalSpacing
	const estimatedRow = Math.round((pixelY - offsetY - hexHeight / 2) / verticalSpacing);

	// Clamp to valid range
	if (estimatedRow < 0 || estimatedRow >= hexesPerCol) {
		return null;
	}

	// Step 4: Verify the calculated position is reasonable
	// Calculate what the center would be for this hex
	const expectedCenterX = estimatedCol * horizontalSpacing + hexRadius;
	const expectedCenterY = estimatedRow * verticalSpacing + offsetY + hexHeight / 2;

	// Check if click is within a reasonable distance (1.5x hex radius)
	const distance = Math.sqrt(
		Math.pow(pixelX - expectedCenterX, 2) + Math.pow(pixelY - expectedCenterY, 2)
	);

	if (distance > hexRadius * 1.5) {
		return null;
	}

	return {
		col: estimatedCol,
		row: estimatedRow
	};
}

/**
 * Converts hex coordinates to a tile key string.
 *
 * @param coords - Hex coordinates {col, row}
 * @returns Tile key in format "col-row"
 */
export function hexToTileKey(coords: HexCoordinates): string {
	return `${coords.col}-${coords.row}`;
}

/**
 * Converts a tile key string to hex coordinates.
 *
 * @param tileKey - Tile key in format "col-row"
 * @returns Hex coordinates {col, row} or null if invalid format
 */
export function tileKeyToHex(tileKey: string): HexCoordinates | null {
	const parts = tileKey.split('-');
	if (parts.length !== 2) return null;

	const col = parseInt(parts[0], 10);
	const row = parseInt(parts[1], 10);

	if (isNaN(col) || isNaN(row)) return null;

	return { col, row };
}
