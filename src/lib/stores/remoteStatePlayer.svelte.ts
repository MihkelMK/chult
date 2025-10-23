import type { TileCoords } from '$lib/types';
import type { LocalStatePlayer } from './localStatePlayer.svelte';

interface PendingOperation {
	coords: TileCoords;
}

function isAdjacent(from: TileCoords, to: TileCoords): boolean {
	const dx = Math.abs(from.x - to.x);
	const dy = Math.abs(from.y - to.y);

	if (dx === 0 && dy === 1) return true; // Vertical neighbors
	if (dy === 0 && dx === 1) return true; // Horizontal neighbors
	if (dx === 1 && dy === 1) {
		// Diagonal neighbors (hex grid specific)
		const evenCol = from.x % 2 === 0;
		if (evenCol) {
			return to.y === from.y - 1 || to.y === from.y + 1;
		} else {
			return to.y === from.y - 1 || to.y === from.y + 1;
		}
	}

	return false;
}

export class RemoteStatePlayer {
	// Public reactive state
	public revealed = $state<TileCoords[]>([]);
	public pending = $state<PendingOperation[] | null>(null);
	public error = $state<string | null>(null);
	public currentPosition = $state<TileCoords | null>(null);

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

	async navigate(coords: TileCoords) {
		// Check if already revealed
		if (this.revealed.some((tile) => tile.x === coords.x && tile.y === coords.y)) {
			return; // Don't navigate to revealed tiles, but don't show an error either
		}

		// Adjacency check
		if (!this.currentPosition) {
			const adjacentToRevealed = this.revealed.some((revealed) => isAdjacent(coords, revealed));
			if (!adjacentToRevealed) {
				this.error = 'You can only explore tiles adjacent to already discovered areas.';
				return;
			}
		} else {
			if (!isAdjacent(this.currentPosition, coords)) {
				this.error = 'You can only move to adjacent tiles.';
				return;
			}
		}

		// Clear any previous errors
		this.error = null;

		// Optimistically update pending state
		this.pending = [{ coords }];
		this.currentPosition = coords;

		try {
			const response = await fetch(`/api/campaigns/${this.campaignSlug}/tiles/navigate`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ coords })
			});

			if (!response.ok) {
				throw new Error('Failed to navigate');
			}

			const data = await response.json();

			// Update revealed tiles with new discoveries
			if (data.revealed && Array.isArray(data.revealed)) {
				this.revealed = data.revealed;
			}

			// Clear pending after successful navigation
			this.pending = null;
		} catch (err) {
			// Rollback optimistic updates on failure
			this.pending = null;
			this.error = err instanceof Error ? err.message : 'Failed to navigate';
		}
	}

	clearError() {
		this.error = null;
	}
}
