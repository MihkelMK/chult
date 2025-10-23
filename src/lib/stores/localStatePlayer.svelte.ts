import type {
	PlayerCampaignDataResponse,
	RevealedTile,
	MapMarkerResponse,
	PlayerMapMarkerResponse
} from '$lib/types';
import { SvelteDate, SvelteSet, SvelteMap } from 'svelte/reactivity';
import { LocalState } from './localState.svelte';

export class LocalStatePlayer extends LocalState {
	// Public reactive Sets - UI source of truth
	public revealedTilesSet = new SvelteSet<string>();
	public alwaysRevealedTilesSet = new SvelteSet<string>();

	// Private markers map for O(1) lookups
	private markersMap = new SvelteMap<number, PlayerMapMarkerResponse>();

	constructor(initialData: PlayerCampaignDataResponse, campaignSlug: string) {
		super(initialData, campaignSlug);

		// Initialize Sets from initial data
		initialData.revealedTiles.forEach((tile) => {
			const key = `${tile.x}-${tile.y}`;
			if (tile.alwaysRevealed) {
				this.alwaysRevealedTilesSet.add(key);
			} else {
				this.revealedTilesSet.add(key);
			}
		});

		this.markersMap = new SvelteMap(initialData.mapMarkers.map((m) => [m.id, m]));

		// Event listeners for synchronization
		this.addEventListener('tiles-revealed-batch', (tiles) =>
			this.handleTilesRevealedBatch(tiles as RevealedTile[])
		);
		this.addEventListener('tile-hidden', (tile) =>
			this.handleTileHidden(tile as Pick<RevealedTile, 'x' | 'y'>)
		);
		this.addEventListener('marker-created', (marker) =>
			this.handleMarkerCreated(marker as PlayerMapMarkerResponse)
		);
		this.addEventListener('marker-updated', (marker) =>
			this.handleMarkerUpdated(marker as PlayerMapMarkerResponse)
		);
		this.addEventListener('marker-deleted', (data) =>
			this.handleMarkerDeleted((data as { id: number }).id)
		);
	}

	// Optimistic UI methods

	async createNote(note: Omit<MapMarkerResponse, 'id' | 'createdAt' | 'updatedAt' | 'type'>) {
		const tempId = -Math.floor(Math.random() * 1000000) - 1;
		const newNote: PlayerMapMarkerResponse = {
			...note,
			id: tempId,
			type: 'note',
			createdAt: new SvelteDate(),
			updatedAt: new SvelteDate()
		};

		// Optimistic update
		(this.campaign as PlayerCampaignDataResponse).mapMarkers.push(newNote);

		try {
			const { id } = await this.makeApiRequest<{ id: number }>('map-markers', 'POST', {
				...note,
				type: 'note'
			});
			const createdNote = (this.campaign as PlayerCampaignDataResponse).mapMarkers.find(
				(n) => n.id === tempId
			);
			if (createdNote) {
				createdNote.id = id;
			}
		} catch (error) {
			// Rollback
			(this.campaign as PlayerCampaignDataResponse).mapMarkers = (
				this.campaign as PlayerCampaignDataResponse
			).mapMarkers.filter((n) => n.id !== tempId);
			console.error('Failed to create note:', error);
		}
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

	private handleMarkerCreated(marker: PlayerMapMarkerResponse) {
		if (this.campaign && 'mapMarkers' in this.campaign) {
			// Check Map first for O(1) duplicate detection
			if (!this.markersMap.has(marker.id)) {
				const newMarker = {
					...marker,
					createdAt: new SvelteDate(marker.createdAt),
					updatedAt: new SvelteDate(marker.updatedAt)
				};
				this.markersMap.set(marker.id, newMarker);
				(this.campaign as PlayerCampaignDataResponse).mapMarkers.push(newMarker);
			}
		}
	}

	private handleMarkerUpdated(marker: PlayerMapMarkerResponse) {
		if (this.campaign && 'mapMarkers' in this.campaign) {
			// O(1) lookup in Map
			if (this.markersMap.has(marker.id)) {
				const index = (this.campaign as PlayerCampaignDataResponse).mapMarkers.findIndex(
					(m) => m.id === marker.id
				);
				if (index !== -1) {
					const updatedMarker = {
						...marker,
						createdAt: new SvelteDate(marker.createdAt),
						updatedAt: new SvelteDate(marker.updatedAt)
					};
					this.markersMap.set(marker.id, updatedMarker);
					(this.campaign as PlayerCampaignDataResponse).mapMarkers[index] = updatedMarker;
				}
			}
		}
	}

	private handleTileHidden(tile: Pick<RevealedTile, 'x' | 'y'>) {
		if (this.campaign && 'revealedTiles' in this.campaign) {
			const key = `${tile.x}-${tile.y}`;

			// Remove from both Sets (O(1))
			const wasRevealed = this.revealedTilesSet.delete(key);
			const wasAlwaysRevealed = this.alwaysRevealedTilesSet.delete(key);

			// Only filter array if tile was actually revealed
			if (wasRevealed || wasAlwaysRevealed) {
				(this.campaign as PlayerCampaignDataResponse).revealedTiles = (
					this.campaign as PlayerCampaignDataResponse
				).revealedTiles.filter((t) => !(t.x === tile.x && t.y === tile.y));
			}
		}
	}

	private handleMarkerDeleted(id: number) {
		if (this.campaign && 'mapMarkers' in this.campaign) {
			// O(1) check and delete from Map
			if (this.markersMap.delete(id)) {
				// Only filter array if marker existed
				(this.campaign as PlayerCampaignDataResponse).mapMarkers = (
					this.campaign as PlayerCampaignDataResponse
				).mapMarkers.filter((m) => m.id !== id);
			}
		}
	}
}
