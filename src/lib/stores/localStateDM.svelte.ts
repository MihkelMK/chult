import { LocalState } from './localState.svelte';
import type { CampaignDataResponse, MapMarkerResponse, RevealedTileResponse } from '$lib/types';
import { SvelteDate, SvelteMap, SvelteSet } from 'svelte/reactivity';
import { untrack } from 'svelte';

export class LocalStateDM extends LocalState {
	// Public reactive Sets - UI source of truth
	public revealedTilesSet = $state(new SvelteSet<string>());
	public alwaysRevealedTilesSet = $state(new SvelteSet<string>());

	// Private markers map for O(1) lookups
	private markersMap = new SvelteMap<number, MapMarkerResponse>();

	constructor(initialData: CampaignDataResponse, campaignSlug: string) {
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
			this.handleTilesRevealedBatch(tiles as RevealedTileResponse[])
		);
		this.addEventListener('tile-hidden', (tile) =>
			this.handleTileHidden(tile as Pick<RevealedTileResponse, 'x' | 'y'>)
		);
		this.addEventListener('marker-created', (marker) =>
			this.handleMarkerCreated(marker as MapMarkerResponse)
		);
		this.addEventListener('marker-updated', (marker) =>
			this.handleMarkerUpdated(marker as MapMarkerResponse)
		);
		this.addEventListener('marker-deleted', (data) =>
			this.handleMarkerDeleted((data as { id: number }).id)
		);
	}

	// Local state update methods (no API calls - used by remoteState and SSE)
	updateRevealedTiles(tiles: { x: number; y: number }[], alwaysRevealed: boolean = false) {
		// Batch all Set mutations without triggering reactivity
		let addedCount = 0;
		untrack(() => {
			tiles.forEach((tile) => {
				const key = `${tile.x}-${tile.y}`;
				if (!this.revealedTilesSet.has(key) && !this.alwaysRevealedTilesSet.has(key)) {
					if (alwaysRevealed) {
						this.alwaysRevealedTilesSet.add(key);
					} else {
						this.revealedTilesSet.add(key);
					}
					addedCount++;
				}
			});
		});

		// Only trigger reactivity if tiles were actually added
		if (addedCount > 0) {
			// Trigger reactivity ONCE after all mutations by creating new Set instances
			this.revealedTilesSet = new SvelteSet(this.revealedTilesSet);
			this.alwaysRevealedTilesSet = new SvelteSet(this.alwaysRevealedTilesSet);
			this.tilesVersion++; // Force reactive recalculation

			// Keep array in sync for serialization
			(this.campaign as CampaignDataResponse).revealedTiles.push(
				...tiles.map((t) => ({ ...t, alwaysRevealed, revealedAt: new SvelteDate() }))
			);
		}
	}

	updateHiddenTiles(tiles: { x: number; y: number }[]) {
		// Batch all Set mutations without triggering reactivity
		let removedCount = 0;
		untrack(() => {
			tiles.forEach((tile) => {
				const key = `${tile.x}-${tile.y}`;
				if (this.revealedTilesSet.delete(key) || this.alwaysRevealedTilesSet.delete(key)) {
					removedCount++;
				}
			});
		});

		// Only trigger reactivity if tiles were actually removed
		if (removedCount > 0) {
			// Trigger reactivity ONCE after all mutations by creating new Set instances
			this.revealedTilesSet = new SvelteSet(this.revealedTilesSet);
			this.alwaysRevealedTilesSet = new SvelteSet(this.alwaysRevealedTilesSet);
			this.tilesVersion++; // Force reactive recalculation

			// Update array to match Sets
			(this.campaign as CampaignDataResponse).revealedTiles = (
				this.campaign as CampaignDataResponse
			).revealedTiles.filter((t) => !tiles.some((tile) => tile.x === t.x && tile.y === t.y));
		}
	}

	updateToggledAlwaysRevealed(tiles: { x: number; y: number }[], alwaysRevealed: boolean) {
		// Batch all Set mutations without triggering reactivity
		let changedCount = 0;
		untrack(() => {
			tiles.forEach((tile) => {
				const key = `${tile.x}-${tile.y}`;

				if (alwaysRevealed) {
					// Moving to alwaysRevealed
					if (this.revealedTilesSet.has(key)) {
						this.revealedTilesSet.delete(key);
						this.alwaysRevealedTilesSet.add(key);
						changedCount++;
					} else if (!this.alwaysRevealedTilesSet.has(key)) {
						this.alwaysRevealedTilesSet.add(key);
						changedCount++;
					}
				} else {
					// Moving to revealed (removing always-revealed flag)
					if (this.alwaysRevealedTilesSet.has(key)) {
						this.alwaysRevealedTilesSet.delete(key);
						this.revealedTilesSet.add(key);
						changedCount++;
					}
				}
			});
		});

		// Only trigger reactivity if tiles were actually changed
		if (changedCount > 0) {
			// Trigger reactivity ONCE after all mutations by creating new Set instances
			this.revealedTilesSet = new SvelteSet(this.revealedTilesSet);
			this.alwaysRevealedTilesSet = new SvelteSet(this.alwaysRevealedTilesSet);
			this.tilesVersion++; // Force reactive recalculation

			// Update array to match Sets
			const existingTileMap = new SvelteMap(
				(this.campaign as CampaignDataResponse).revealedTiles.map((t) => [`${t.x},${t.y}`, t])
			);

			tiles.forEach((tile) => {
				const key = `${tile.x},${tile.y}`;
				const existing = existingTileMap.get(key);

				if (existing) {
					existing.alwaysRevealed = alwaysRevealed;
				} else if (alwaysRevealed) {
					// Create new always-revealed tile
					(this.campaign as CampaignDataResponse).revealedTiles.push({
						...tile,
						alwaysRevealed: true,
						revealedAt: new SvelteDate()
					});
				}
			});
		}
	}

	async createMarker(marker: Omit<MapMarkerResponse, 'id' | 'createdAt' | 'updatedAt'>) {
		const tempId = -Math.floor(Math.random() * 1000000) - 1; // Unique temporary ID for the optimistic update
		const newMarker: MapMarkerResponse = {
			...marker,
			id: tempId,
			createdAt: new SvelteDate(),
			updatedAt: new SvelteDate()
		};

		// Optimistic update
		(this.campaign as CampaignDataResponse).mapMarkers.push(newMarker);

		try {
			const { id } = await this.makeApiRequest<{ id: number }>('map-markers', 'POST', marker);
			// Reconcile with the actual ID from the server
			const createdMarker = (this.campaign as CampaignDataResponse).mapMarkers.find(
				(m) => m.id === tempId
			);
			if (createdMarker) {
				createdMarker.id = id;
			}
		} catch (error) {
			// Rollback
			(this.campaign as CampaignDataResponse).mapMarkers = (
				this.campaign as CampaignDataResponse
			).mapMarkers.filter((m) => m.id !== tempId);
			console.error('Failed to create marker:', error);
		}
	}

	// Event handlers for synchronization

	private handleTilesRevealedBatch(tiles: RevealedTileResponse[]) {
		// Filter out already-revealed tiles to avoid unnecessary work
		const regularTiles: { x: number; y: number }[] = [];
		const alwaysTiles: { x: number; y: number }[] = [];

		// Single pass: filter duplicates and group by alwaysRevealed flag
		for (const tile of tiles) {
			const key = `${tile.x}-${tile.y}`;
			if (!this.revealedTilesSet.has(key) && !this.alwaysRevealedTilesSet.has(key)) {
				if (tile.alwaysRevealed) {
					alwaysTiles.push({ x: tile.x, y: tile.y });
				} else {
					regularTiles.push({ x: tile.x, y: tile.y });
				}
			}
		}

		// Early return if all tiles already revealed (from optimistic update)
		if (regularTiles.length === 0 && alwaysTiles.length === 0) {
			return;
		}

		// Batch update
		if (regularTiles.length > 0) {
			this.updateRevealedTiles(regularTiles, false);
		}
		if (alwaysTiles.length > 0) {
			this.updateRevealedTiles(alwaysTiles, true);
		}
	}

	private handleMarkerCreated(marker: MapMarkerResponse) {
		if (this.campaign && 'mapMarkers' in this.campaign) {
			// Check Map first for O(1) duplicate detection
			if (!this.markersMap.has(marker.id)) {
				const newMarker = {
					...marker,
					createdAt: new SvelteDate(marker.createdAt),
					updatedAt: new SvelteDate(marker.updatedAt)
				};
				this.markersMap.set(marker.id, newMarker);
				(this.campaign as CampaignDataResponse).mapMarkers.push(newMarker);
			}
		}
	}

	private handleMarkerUpdated(marker: MapMarkerResponse) {
		if (this.campaign && 'mapMarkers' in this.campaign) {
			// O(1) lookup in Map
			if (this.markersMap.has(marker.id)) {
				const index = (this.campaign as CampaignDataResponse).mapMarkers.findIndex(
					(m) => m.id === marker.id
				);
				if (index !== -1) {
					const updatedMarker = {
						...marker,
						createdAt: new SvelteDate(marker.createdAt),
						updatedAt: new SvelteDate(marker.updatedAt)
					};
					this.markersMap.set(marker.id, updatedMarker);
					(this.campaign as CampaignDataResponse).mapMarkers[index] = updatedMarker;
				}
			}
		}
	}

	private handleTileHidden(tile: Pick<RevealedTileResponse, 'x' | 'y'>) {
		// Use the batched update method (even for single tile from SSE)
		this.updateHiddenTiles([{ x: tile.x, y: tile.y }]);
	}

	private handleMarkerDeleted(id: number) {
		if (this.campaign && 'mapMarkers' in this.campaign) {
			// O(1) check and delete from Map
			if (this.markersMap.delete(id)) {
				// Only filter array if marker existed
				(this.campaign as CampaignDataResponse).mapMarkers = (
					this.campaign as CampaignDataResponse
				).mapMarkers.filter((m) => m.id !== id);
			}
		}
	}
}
