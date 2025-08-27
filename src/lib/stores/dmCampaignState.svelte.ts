import { CampaignState } from './campaignState.svelte';
import type { CampaignDataResponse, MapMarkerResponse, RevealedTileResponse } from '$lib/types';
import { SvelteDate } from 'svelte/reactivity';

export class DMCampaignState extends CampaignState {
	constructor(initialData: CampaignDataResponse, campaignSlug: string) {
		super(initialData, campaignSlug);

		// Event listeners for synchronization
		this.addEventListener('tile-revealed', (tile) =>
			this.handleTileRevealed(tile as RevealedTileResponse)
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

	// Optimistic UI methods

	async revealTiles(tiles: { x: number; y: number }[], alwaysRevealed: boolean = false) {
		const originalRevealedTiles = [...(this.campaign as CampaignDataResponse).revealedTiles];

		// Optimistic update
		(this.campaign as CampaignDataResponse).revealedTiles.push(
			...tiles.map((t) => ({ ...t, alwaysRevealed, revealedAt: new SvelteDate() }))
		);

		try {
			await this.makeApiRequest('tiles/batch', 'POST', { type: 'reveal', tiles, alwaysRevealed });
		} catch (error) {
			// Rollback
			(this.campaign as CampaignDataResponse).revealedTiles = originalRevealedTiles;
			console.error('Failed to reveal tiles:', error);
		}
	}

	async toggleAlwaysRevealed(tiles: { x: number; y: number }[], alwaysRevealed: boolean) {
		const originalRevealedTiles = [...(this.campaign as CampaignDataResponse).revealedTiles];

		// Optimistic update - update existing tiles and add new ones if needed
		const existingTileMap = new Map(
			(this.campaign as CampaignDataResponse).revealedTiles.map(
				(t) => [`${t.x},${t.y}`, t]
			)
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

		try {
			await this.makeApiRequest('tiles/batch', 'POST', { 
				type: 'toggle-always-revealed', 
				tiles, 
				alwaysRevealed 
			});
		} catch (error) {
			// Rollback
			(this.campaign as CampaignDataResponse).revealedTiles = originalRevealedTiles;
			console.error('Failed to toggle always-revealed tiles:', error);
		}
	}

	async createMarker(marker: Omit<MapMarkerResponse, 'id' | 'createdAt' | 'updatedAt'>) {
		const tempId = -1; // Temporary ID for the optimistic update
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

	private handleTileRevealed(tile: RevealedTileResponse) {
		if (this.campaign && 'revealedTiles' in this.campaign) {
			(this.campaign as CampaignDataResponse).revealedTiles.push({
				...tile,
				revealedAt: new SvelteDate(tile.revealedAt)
			});
		}
	}

	private handleMarkerCreated(marker: MapMarkerResponse) {
		if (this.campaign && 'mapMarkers' in this.campaign) {
			(this.campaign as CampaignDataResponse).mapMarkers.push({
				...marker,
				createdAt: new SvelteDate(marker.createdAt),
				updatedAt: new SvelteDate(marker.updatedAt)
			});
		}
	}

	private handleMarkerUpdated(marker: MapMarkerResponse) {
		if (this.campaign && 'mapMarkers' in this.campaign) {
			const index = (this.campaign as CampaignDataResponse).mapMarkers.findIndex(
				(m) => m.id === marker.id
			);
			if (index !== -1) {
				(this.campaign as CampaignDataResponse).mapMarkers[index] = {
					...marker,
					createdAt: new SvelteDate(marker.createdAt),
					updatedAt: new SvelteDate(marker.updatedAt)
				};
			}
		}
	}

	private handleTileHidden(tile: Pick<RevealedTileResponse, 'x' | 'y'>) {
		if (this.campaign && 'revealedTiles' in this.campaign) {
			(this.campaign as CampaignDataResponse).revealedTiles = (
				this.campaign as CampaignDataResponse
			).revealedTiles.filter((t) => !(t.x === tile.x && t.y === tile.y));
		}
	}

	private handleMarkerDeleted(id: number) {
		if (this.campaign && 'mapMarkers' in this.campaign) {
			(this.campaign as CampaignDataResponse).mapMarkers = (
				this.campaign as CampaignDataResponse
			).mapMarkers.filter((m) => m.id !== id);
		}
	}
}
