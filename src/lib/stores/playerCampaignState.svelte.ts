import { CampaignState } from './campaignState.svelte';
import type {
	PlayerCampaignDataResponse,
	RevealedTile,
	MapMarkerResponse,
	PlayerMapMarkerResponse
} from '$lib/types';
import { SvelteDate } from 'svelte/reactivity';

export class PlayerCampaignState extends CampaignState {
	constructor(initialData: PlayerCampaignDataResponse, campaignSlug: string) {
		super(initialData, campaignSlug);

		// Event listeners for synchronization
		this.addEventListener('tile-revealed', (tile) =>
			this.handleTileRevealed(tile as Pick<RevealedTile, 'x' | 'y'>)
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

	private handleTileRevealed(tile: Pick<RevealedTile, 'x' | 'y'>) {
		if (this.campaign && 'revealedTiles' in this.campaign) {
			(this.campaign as PlayerCampaignDataResponse).revealedTiles.push({
				...tile,
				alwaysRevealed: false // Default to false for player-received tiles
			});
		}
	}

	private handleMarkerCreated(marker: PlayerMapMarkerResponse) {
		if (this.campaign && 'mapMarkers' in this.campaign) {
			(this.campaign as PlayerCampaignDataResponse).mapMarkers.push({
				...marker,
				createdAt: new SvelteDate(marker.createdAt),
				updatedAt: new SvelteDate(marker.updatedAt)
			});
		}
	}

	private handleMarkerUpdated(marker: PlayerMapMarkerResponse) {
		if (this.campaign && 'mapMarkers' in this.campaign) {
			const index = (this.campaign as PlayerCampaignDataResponse).mapMarkers.findIndex(
				(m) => m.id === marker.id
			);
			if (index !== -1) {
				(this.campaign as PlayerCampaignDataResponse).mapMarkers[index] = {
					...marker,
					createdAt: new SvelteDate(marker.createdAt),
					updatedAt: new SvelteDate(marker.updatedAt)
				};
			}
		}
	}

	private handleTileHidden(tile: Pick<RevealedTile, 'x' | 'y'>) {
		if (this.campaign && 'revealedTiles' in this.campaign) {
			(this.campaign as PlayerCampaignDataResponse).revealedTiles = (
				this.campaign as PlayerCampaignDataResponse
			).revealedTiles.filter((t) => !(t.x === tile.x && t.y === tile.y));
		}
	}

	private handleMarkerDeleted(id: number) {
		if (this.campaign && 'mapMarkers' in this.campaign) {
			(this.campaign as PlayerCampaignDataResponse).mapMarkers = (
				this.campaign as PlayerCampaignDataResponse
			).mapMarkers.filter((m) => m.id !== id);
		}
	}
}
