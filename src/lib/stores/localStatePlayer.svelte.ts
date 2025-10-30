import type {
	GameSessionResponse,
	MapMarkerResponse,
	PathStep,
	PlayerCampaignDataResponse,
	RevealedTile
} from '$lib/types';
import { SvelteSet } from 'svelte/reactivity';
import { LocalState } from './localState.svelte';

export class LocalStatePlayer extends LocalState {
	// Public reactive Sets - UI source of truth
	public revealedTilesSet = new SvelteSet<string>();
	public alwaysRevealedTilesSet = new SvelteSet<string>();

	constructor(initialData: PlayerCampaignDataResponse, campaignSlug: string) {
		super(initialData, campaignSlug);

		// Initialize Sets and markers map using base class methods
		this.initializeRevealedTileSets(initialData.revealedTiles);
		this.initializeMarkersMap(initialData.mapMarkers);

		// Event listeners for synchronization
		this.addEventListener('tiles:revealed:batch', (tiles) =>
			this.handleTilesRevealedBatch(tiles as RevealedTile[])
		);
		this.addEventListener('tile:hidden', (tile) =>
			super.handleTileHidden(tile as Pick<RevealedTile, 'x' | 'y'>)
		);
		this.addEventListener('marker:created', (marker) =>
			super.handleMarkerCreated(marker as MapMarkerResponse)
		);
		this.addEventListener('marker:updated', (marker) =>
			super.handleMarkerUpdated(marker as MapMarkerResponse)
		);
		this.addEventListener('marker:deleted', (data) =>
			super.handleMarkerDeleted((data as { id: number }).id)
		);

		// Exploration event listeners (NEW)
		this.addEventListener('movement:step-added', (data) =>
			super.handleMovementStepAdded(data as { sessionId: number; step: PathStep; tiles: string[] })
		);
		this.addEventListener('time:updated', (data) =>
			super.handleTimeUpdated(data as { globalGameTime: number })
		);
		this.addEventListener('session:started', (session) =>
			super.handleSessionStarted(session as GameSessionResponse)
		);
		this.addEventListener('session:ended', (session) =>
			super.handleSessionEnded(session as GameSessionResponse)
		);
		this.addEventListener('session:deleted', (data) =>
			super.handleSessionDeleted(data as { id: number })
		);
	}

	// Event handlers for synchronization
	private handleTilesRevealedBatch(tiles: RevealedTile[]) {
		if (this.campaign && 'revealedTiles' in this.campaign) {
			const newTiles: RevealedTile[] = [];

			for (const tile of tiles) {
				const key = `${tile.x}-${tile.y}`;

				// O(1) duplicate check using Sets
				if (!this.revealedTilesSet.has(key) && !this.alwaysRevealedTilesSet.has(key)) {
					// Add to appropriate Set based on alwaysRevealed flag
					if (tile.alwaysRevealed) {
						this.alwaysRevealedTilesSet.add(key);
					} else {
						this.revealedTilesSet.add(key);
					}
					newTiles.push(tile);
				}
			}

			// Batch update array
			if (newTiles.length > 0) {
				(this.campaign as PlayerCampaignDataResponse).revealedTiles.push(...newTiles);
			}
		}
	}
}
