import { PRIVATE_REVEAL_SEA } from '$env/static/private';
import { seaTiles } from '$lib/data/tilesDefinitions';
import type { TileCoords } from '$lib/types';

export function load() {
	const tiles: TileCoords[] = PRIVATE_REVEAL_SEA === 'true' ? seaTiles : [];

	return {
		tiles
	};
}
