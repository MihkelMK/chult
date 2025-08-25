import type { TileCoords, TileCoordsRange } from '$lib/types';

/**
 * Translates an array of coordinate ranges into a flat array of individual coordinate objects.
 * @param ranges The array of coordinate ranges to translate.
 * @returns A new array containing all individual coordinate objects.
 */
function translateRangesToObjects(ranges: TileCoordsRange[]): { x: number; y: number }[] {
	return ranges.flatMap((range) => {
		const coordinates = [];
		// Loop from the start to the end of the x-range for the given y.
		for (let x = range.xStart; x <= range.xEnd; x++) {
			for (let y = range.yStart; y <= range.yEnd; y++) {
				coordinates.push({ x, y });
			}
		}
		return coordinates;
	});
}

// Data for the sea, defined as ranges for a more compact representation.
const seaRanges: TileCoordsRange[] = [
	{ yStart: 0, yEnd: 22, xStart: 1, xEnd: 31 },
	{ yStart: 0, yEnd: 10, xStart: 29, xEnd: 73 },
	{ yStart: 8, yEnd: 42, xStart: 54, xEnd: 73 },
	{ yStart: 23, yEnd: 24, xStart: 10, xEnd: 26 },
	{ yStart: 27, yEnd: 36, xStart: 10, xEnd: 14 },
	{ yStart: 25, yEnd: 26, xStart: 10, xEnd: 22 },
	{ yStart: 43, yEnd: 43, xStart: 64, xEnd: 65 },
	{ yStart: 42, yEnd: 47, xStart: 64, xEnd: 73 },
	{ yStart: 23, yEnd: 85, xStart: 1, xEnd: 9 },
	{ yStart: 58, yEnd: 85, xStart: 8, xEnd: 18 },
	{ yStart: 64, yEnd: 85, xStart: 16, xEnd: 37 },
	{ yStart: 73, yEnd: 85, xStart: 34, xEnd: 55 },
	{ yStart: 81, yEnd: 85, xStart: 66, xEnd: 73 },
	{ yStart: 78, yEnd: 85, xStart: 56, xEnd: 65 },
	{ xStart: 32, xEnd: 42, yStart: 11, yEnd: 13 },
	{ xStart: 44, xEnd: 53, yStart: 11, yEnd: 13 },
	{ xStart: 32, xEnd: 32, yStart: 14, yEnd: 19 },
	{ xStart: 34, xEnd: 42, yStart: 14, yEnd: 14 },
	{ xStart: 46, xEnd: 53, yStart: 14, yEnd: 14 },
	{ xStart: 33, xEnd: 33, yStart: 15, yEnd: 19 },
	{ xStart: 35, xEnd: 43, yStart: 15, yEnd: 15 },
	{ xStart: 48, xEnd: 50, yStart: 15, yEnd: 15 },
	{ xStart: 36, xEnd: 43, yStart: 16, yEnd: 17 },
	{ xStart: 53, xEnd: 53, yStart: 17, yEnd: 31 },
	{ xStart: 34, xEnd: 34, yStart: 18, yEnd: 19 },
	{ xStart: 36, xEnd: 42, yStart: 18, yEnd: 18 },
	{ xStart: 52, xEnd: 52, yStart: 18, yEnd: 31 },
	{ xStart: 37, xEnd: 41, yStart: 19, yEnd: 19 },
	{ xStart: 38, xEnd: 41, yStart: 20, yEnd: 20 },
	{ xStart: 39, xEnd: 40, yStart: 21, yEnd: 21 },
	{ xStart: 27, xEnd: 28, yStart: 23, yEnd: 23 },
	{ xStart: 51, xEnd: 51, yStart: 23, yEnd: 29 },
	{ xStart: 15, xEnd: 18, yStart: 27, yEnd: 27 },
	{ xStart: 49, xEnd: 50, yStart: 27, yEnd: 29 },
	{ xStart: 15, xEnd: 16, yStart: 28, yEnd: 28 },
	{ xStart: 48, xEnd: 48, yStart: 29, yEnd: 30 },
	{ xStart: 53, xEnd: 53, yStart: 36, yEnd: 44 },
	{ xStart: 15, xEnd: 15, yStart: 40, yEnd: 44 },
	{ xStart: 52, xEnd: 52, yStart: 40, yEnd: 44 },
	{ xStart: 12, xEnd: 14, yStart: 41, yEnd: 45 },
	{ xStart: 16, xEnd: 17, yStart: 41, yEnd: 41 },
	{ xStart: 51, xEnd: 51, yStart: 41, yEnd: 43 },
	{ xStart: 16, xEnd: 16, yStart: 42, yEnd: 44 },
	{ xStart: 10, xEnd: 11, yStart: 43, yEnd: 50 },
	{ xStart: 54, xEnd: 56, yStart: 43, yEnd: 43 },
	{ xStart: 60, xEnd: 63, yStart: 43, yEnd: 43 },
	{ xStart: 62, xEnd: 63, yStart: 44, yEnd: 44 },
	{ xStart: 12, xEnd: 13, yStart: 46, yEnd: 46 },
	{ xStart: 12, xEnd: 12, yStart: 47, yEnd: 48 },
	{ xStart: 72, xEnd: 73, yStart: 48, yEnd: 49 },
	{ xStart: 17, xEnd: 17, yStart: 55, yEnd: 57 },
	{ xStart: 16, xEnd: 16, yStart: 56, yEnd: 57 },
	{ xStart: 19, xEnd: 19, yStart: 58, yEnd: 60 },
	{ xStart: 31, xEnd: 31, yStart: 62, yEnd: 63 },
	{ xStart: 33, xEnd: 33, yStart: 62, yEnd: 63 },
	{ xStart: 23, xEnd: 24, yStart: 63, yEnd: 63 },
	{ xStart: 29, xEnd: 30, yStart: 63, yEnd: 63 },
	{ xStart: 45, xEnd: 45, yStart: 63, yEnd: 70 },
	{ xStart: 47, xEnd: 47, yStart: 63, yEnd: 72 },
	{ xStart: 43, xEnd: 44, yStart: 64, yEnd: 64 },
	{ xStart: 46, xEnd: 46, yStart: 64, yEnd: 70 },
	{ xStart: 48, xEnd: 49, yStart: 64, yEnd: 72 },
	{ xStart: 51, xEnd: 51, yStart: 64, yEnd: 72 },
	{ xStart: 39, xEnd: 39, yStart: 65, yEnd: 67 },
	{ xStart: 50, xEnd: 50, yStart: 65, yEnd: 72 },
	{ xStart: 52, xEnd: 52, yStart: 65, yEnd: 72 },
	{ xStart: 38, xEnd: 38, yStart: 66, yEnd: 68 },
	{ xStart: 53, xEnd: 53, yStart: 66, yEnd: 69 },
	{ xStart: 43, xEnd: 44, yStart: 67, yEnd: 70 },
	{ xStart: 41, xEnd: 42, yStart: 68, yEnd: 70 },
	{ xStart: 38, xEnd: 39, yStart: 72, yEnd: 72 },
	{ xStart: 56, xEnd: 56, yStart: 74, yEnd: 77 },
	{ xStart: 63, xEnd: 64, yStart: 74, yEnd: 77 },
	{ xStart: 61, xEnd: 62, yStart: 75, yEnd: 77 },
	{ xStart: 65, xEnd: 65, yStart: 75, yEnd: 77 },
	{ xStart: 60, xEnd: 60, yStart: 76, yEnd: 77 },
	{ xStart: 66, xEnd: 66, yStart: 77, yEnd: 78 },
	{ xStart: 70, xEnd: 73, yStart: 79, yEnd: 80 }
];

// Data for smaller islands and landmasses, represented as individual coordinates.
const seaIndividual: TileCoords[] = [
	{ x: 15, y: 29 },
	{ x: 53, y: 34 },
	{ x: 54, y: 44 },
	{ x: 63, y: 46 },
	{ x: 68, y: 48 },
	{ x: 10, y: 51 },
	{ x: 15, y: 57 },
	{ x: 18, y: 57 },
	{ x: 21, y: 63 },
	{ x: 32, y: 63 },
	{ x: 34, y: 63 },
	{ x: 44, y: 65 },
	{ x: 54, y: 67 },
	{ x: 54, y: 69 },
	{ x: 42, y: 71 },
	{ x: 44, y: 71 },
	{ x: 53, y: 72 },
	{ x: 66, y: 80 },
	{ x: 69, y: 80 }
];

// Array of coordinates not visible on the main map.
export const hiddenLocations: TileCoords[] = [];

export const seaTiles = translateRangesToObjects(seaRanges).concat(seaIndividual);
