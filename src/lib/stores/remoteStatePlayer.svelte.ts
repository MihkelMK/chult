import type { TileCoords, UserRole } from '$lib/types';
import type { MapMarkerResponse } from '$lib/types/database';
import { SvelteDate } from 'svelte/reactivity';
import type { LocalStatePlayer } from './localStatePlayer.svelte';

interface PendingOperation {
	coords: TileCoords;
}

export class RemoteStatePlayer {
	// Public reactive state
	public revealed = $state<TileCoords[]>([]);
	public pending = $state<PendingOperation[] | null>(null);
	public error = $state<string | null>(null);

	private campaignSlug: string;
	private localState?: LocalStatePlayer;

	constructor(campaignSlug: string, localState?: LocalStatePlayer) {
		this.campaignSlug = campaignSlug;
		this.localState = localState;

		// Connect to local state events if available
		if (localState) {
			localState.addEventListener('tile:revealed', (tile: Pick<TileCoords, 'x' | 'y'>) => {
				// Only add if not already revealed and not from our own optimistic update
				if (!this.revealed.some((t) => t.x === tile.x && t.y === tile.y)) {
					this.revealed = [...this.revealed, { x: tile.x, y: tile.y }];
				}
			});

			localState.addEventListener('tile:hidden', (tile: Pick<TileCoords, 'x' | 'y'>) => {
				this.revealed = this.revealed.filter((t) => !(t.x === tile.x && t.y === tile.y));
			});
		}
	}

	async addPlayerMove(tileKey: string) {
		if (!this.localState) {
			throw new Error('Local state not available');
		}

		const activeSession = this.localState.activeSession;
		if (!activeSession) {
			throw new Error('No active session');
		}

		// Save original state for rollback
		const originalPosition = this.localState.partyTokenPosition;
		const originalGameTime = this.localState.globalGameTime;

		// Optimistic update
		const [x, y] = tileKey.split('-').map(Number);
		this.localState.partyTokenPosition = { x, y };
		this.localState.globalGameTime += 0.5;

		try {
			const response = await fetch(`/api/campaigns/${this.campaignSlug}/movement/player`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ tileKey })
			});

			if (!response.ok) {
				const errorData = await response.json();
				throw new Error(errorData.message || 'Failed to add player move');
			}

			const result = await response.json();

			// SSE will reconcile the final state
			return result;
		} catch (error) {
			// Rollback on failure
			this.localState.partyTokenPosition = originalPosition;
			this.localState.globalGameTime = originalGameTime;

			// Handle 409 Conflict (position changed) differently
			if (error instanceof Error && error.message.includes('Party position changed')) {
				this.error = 'Party moved - please try again';
			} else {
				this.error = error instanceof Error ? error.message : 'Failed to move';
			}

			console.error('[remoteStatePlayer] Failed to add player move:', error);
			throw error;
		}
	}

	async createMarker(data: {
		x: number;
		y: number;
		type: string;
		title: string;
		content: string | null;
		authorRole: UserRole;
		visibleToPlayers: boolean;
		imagePath: string | null;
	}) {
		if (!this.localState) {
			throw new Error('Local state not available');
		}

		// Create temporary marker for optimistic update
		const tempId = -Math.floor(Math.random() * 1000000) - 1;
		const tempMarker: MapMarkerResponse = {
			...data,
			id: tempId,
			createdAt: new SvelteDate(),
			updatedAt: new SvelteDate()
		};

		// Optimistic update
		if ('mapMarkers' in this.localState.campaign) {
			this.localState.campaign.mapMarkers.push(tempMarker);
			this.localState.markersById.set(tempId, tempMarker);
			this.localState.markersVersion++;
		}

		try {
			const response = await fetch(`/api/campaigns/${this.campaignSlug}/markers`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(data)
			});

			if (!response.ok) {
				const errorData = await response.json();
				throw new Error(errorData.message || 'Failed to create marker');
			}

			const result = await response.json();

			// Replace temp marker with real marker from API response (SSE will be deduplicated)
			if ('mapMarkers' in this.localState.campaign) {
				// Remove temp marker
				const tempIndex = this.localState.campaign.mapMarkers.findIndex((m) => m.id === tempId);
				if (tempIndex !== -1) {
					this.localState.campaign.mapMarkers.splice(tempIndex, 1);
				}
				this.localState.markersById.delete(tempId);

				// Add real marker if it doesn't already exist
				const exists = this.localState.markersById.has(result.id);
				if (!exists) {
					const realMarker: MapMarkerResponse = {
						...result,
						createdAt: new SvelteDate(result.createdAt),
						updatedAt: new SvelteDate(result.updatedAt)
					};
					this.localState.campaign.mapMarkers.push(realMarker);
					this.localState.markersById.set(result.id, realMarker);
					this.localState.markersVersion++;
				}
			}

			return result;
		} catch (error) {
			// Rollback on failure
			if ('mapMarkers' in this.localState.campaign) {
				this.localState.campaign.mapMarkers = this.localState.campaign.mapMarkers.filter(
					(m) => m.id !== tempId
				);
				this.localState.markersById.delete(tempId);
				this.localState.markersVersion++;
			}
			console.error('[remoteStatePlayer] Failed to create marker:', error);
			throw error;
		}
	}

	async updateMarker(
		id: number,
		data: { title?: string; content?: string | null; visibleToPlayers?: boolean }
	) {
		if (!this.localState) {
			throw new Error('Local state not available');
		}

		// Find marker in state
		if (!('mapMarkers' in this.localState.campaign)) {
			throw new Error('Map markers not available');
		}

		const markerIndex = this.localState.campaign.mapMarkers.findIndex((m) => m.id === id);
		if (markerIndex === -1) {
			throw new Error('Marker not found');
		}

		// Save original for rollback
		const originalMarker = { ...this.localState.campaign.mapMarkers[markerIndex] };

		// Optimistic update
		const updatedMarker = {
			...this.localState.campaign.mapMarkers[markerIndex],
			...data,
			updatedAt: new SvelteDate()
		};
		this.localState.campaign.mapMarkers[markerIndex] = updatedMarker;
		this.localState.markersById.set(id, updatedMarker);
		this.localState.markersVersion++;

		try {
			const response = await fetch(`/api/campaigns/${this.campaignSlug}/markers/${id}`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(data)
			});

			if (!response.ok) {
				const errorData = await response.json();
				throw new Error(errorData.message || 'Failed to update marker');
			}

			const result = await response.json();

			// Update with real data from API response
			const realMarker: MapMarkerResponse = {
				...result,
				createdAt: new SvelteDate(result.createdAt),
				updatedAt: new SvelteDate(result.updatedAt)
			};
			this.localState.campaign.mapMarkers[markerIndex] = realMarker;
			this.localState.markersById.set(id, realMarker);
			this.localState.markersVersion++;

			return result;
		} catch (error) {
			// Rollback on failure
			this.localState.campaign.mapMarkers[markerIndex] = originalMarker;
			this.localState.markersById.set(id, originalMarker);
			this.localState.markersVersion++;

			console.error('[remoteStatePlayer] Failed to update marker:', error);
			throw error;
		}
	}

	async deleteMarker(id: number) {
		if (!this.localState) {
			throw new Error('Local state not available');
		}

		if (!('mapMarkers' in this.localState.campaign)) {
			throw new Error('Map markers not available');
		}

		// Find marker in state
		const markerIndex = this.localState.campaign.mapMarkers.findIndex((m) => m.id === id);
		if (markerIndex === -1) {
			throw new Error('Marker not found');
		}

		// Save for rollback
		const deletedMarker = { ...this.localState.campaign.mapMarkers[markerIndex] };

		// Optimistic delete
		this.localState.campaign.mapMarkers.splice(markerIndex, 1);
		this.localState.markersById.delete(id);
		this.localState.markersVersion++;

		try {
			const response = await fetch(`/api/campaigns/${this.campaignSlug}/markers/${id}`, {
				method: 'DELETE'
			});

			if (!response.ok) {
				const errorData = await response.json();
				throw new Error(errorData.message || 'Failed to delete marker');
			}

			// SSE will handle confirmation
			return { success: true };
		} catch (error) {
			// Rollback on failure
			this.localState.campaign.mapMarkers.push(deletedMarker);
			this.localState.markersById.set(id, deletedMarker);
			this.localState.markersVersion++;

			console.error('[remoteStatePlayer] Failed to delete marker:', error);
			throw error;
		}
	}

	clearError() {
		this.error = null;
	}
}
