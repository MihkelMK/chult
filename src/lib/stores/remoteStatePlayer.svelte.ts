import type { TileCoords } from '$lib/types';
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
			localState.addEventListener('tile-revealed', (tile: Pick<TileCoords, 'x' | 'y'>) => {
				// Only add if not already revealed and not from our own optimistic update
				if (!this.revealed.some((t) => t.x === tile.x && t.y === tile.y)) {
					this.revealed = [...this.revealed, { x: tile.x, y: tile.y }];
				}
			});

			localState.addEventListener('tile-hidden', (tile: Pick<TileCoords, 'x' | 'y'>) => {
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
			console.log('[remoteStateDM] Player move added:', result);

			// SSE will handle the state update
			return result;
		} catch (error) {
			console.error('[remoteStateDM] Failed to add player move:', error);
			throw error;
		}
	}

	clearError() {
		this.error = null;
	}
}
