import { writable } from 'svelte/store';
import type { TileCoords } from '$lib/types';
import type { PlayerCampaignState } from './playerCampaignState.svelte';

interface PendingOperation {
	coords: TileCoords;
}

interface PlayerTileState {
	revealed: TileCoords[];
	pending: PendingOperation | null;
	error: string | null;
	currentPosition: TileCoords | null;
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

function createPlayerTileManager(
	campaignSlug: string,
	initialRevealed: TileCoords[],
	initialPosition: TileCoords | null,
	campaignState?: PlayerCampaignState
) {
	const { subscribe, update } = writable<PlayerTileState>({
		revealed: initialRevealed,
		pending: null,
		error: null,
		currentPosition: initialPosition
	});

	// Connect to campaign state events if available
	if (campaignState) {
		campaignState.addEventListener('tile-revealed', (tile: Pick<TileCoords, 'x' | 'y'>) => {
			update((state) => {
				// Only add if not already revealed and not from our own optimistic update
				if (!state.revealed.some((t) => t.x === tile.x && t.y === tile.y)) {
					return {
						...state,
						revealed: [...state.revealed, { x: tile.x, y: tile.y }]
					};
				}
				return state;
			});
		});

		campaignState.addEventListener('tile-hidden', (tile: Pick<TileCoords, 'x' | 'y'>) => {
			update((state) => ({
				...state,
				revealed: state.revealed.filter((t) => !(t.x === tile.x && t.y === tile.y))
			}));
		});
	}

	async function navigate(coords: TileCoords) {
		let currentState: PlayerTileState;
		const unsubscribe = subscribe((state) => {
			currentState = state;
		});
		unsubscribe();

		// Check if already revealed
		if (currentState!.revealed.some((tile) => tile.x === coords.x && tile.y === coords.y)) {
			return; // Don't navigate to revealed tiles, but don't show an error either
		}

		// Adjacency check
		if (!currentState!.currentPosition) {
			const adjacentToRevealed = currentState!.revealed.some((revealed) =>
				isAdjacent(coords, revealed)
			);
			if (!adjacentToRevealed) {
				update((state) => ({
					...state,
					error: 'You can only explore tiles adjacent to already discovered areas.'
				}));
				return;
			}
		} else {
			if (!isAdjacent(currentState!.currentPosition, coords)) {
				update((state) => ({
					...state,
					error: 'You can only move to adjacent tiles.'
				}));
				return;
			}
		}

		// Optimistic update
		update((state) => ({
			...state,
			pending: { coords },
			error: null
		}));

		try {
			const response = await fetch(`/api/campaigns/${campaignSlug}/player/navigate`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(coords)
			});

			if (!response.ok) {
				const error = await response.json();
				throw new Error(error.message || 'Navigation failed');
			}

			// Success - update state
			update((state) => ({
				...state,
				revealed: [...state.revealed, coords],
				currentPosition: coords,
				pending: null
			}));
		} catch (error: unknown) {
			// Rollback on failure
			let errorMessage = 'Failed to navigate. Please try again.';
			if (error instanceof Error) {
				errorMessage = error.message;
			} else if (
				typeof error === 'object' &&
				error !== null &&
				'message' in error &&
				typeof (error as { message: unknown }).message === 'string'
			) {
				errorMessage = (error as { message: string }).message;
			}
			update((state) => ({
				...state,
				pending: null,
				error: errorMessage
			}));
		}
	}

	return {
		subscribe,
		navigate,
		clearError: () => update((state) => ({ ...state, error: null }))
	};
}

export { createPlayerTileManager, type PlayerTileState };
