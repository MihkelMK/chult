import { writable } from 'svelte/store';
import type { TileCoords } from '$lib/types';
import type { DMCampaignState } from './dmCampaignState.svelte';

interface PendingOperation {
	type: 'reveal' | 'hide';
	coords: TileCoords;
	timestamp: number;
	alwaysRevealed?: boolean;
}

interface RevealedTile extends TileCoords {
	alwaysRevealed: boolean;
	revealedAt: Date;
}

interface TileState {
	revealed: RevealedTile[];
	pending: PendingOperation[];
	errors: { coords: TileCoords; message: string }[];
}

function createTileManager(
	campaignSlug: string,
	initialRevealed: any[] = [], // Accept full revealed tile objects or basic coords
	campaignState?: DMCampaignState
) {
	const { subscribe, update } = writable<TileState>({
		revealed: initialRevealed.map(tile => ({
			x: tile.x,
			y: tile.y,
			alwaysRevealed: tile.alwaysRevealed ?? false,
			revealedAt: tile.revealedAt ? new Date(tile.revealedAt) : new Date()
		})),
		pending: [],
		errors: []
	});

	// Connect to campaign state events if available
	if (campaignState) {
		campaignState.addEventListener('tile-revealed', (tile: any) => {
			update((state) => {
				// Only add if not already revealed and not from our own optimistic update
				if (
					!state.revealed.some((t) => t.x === tile.x && t.y === tile.y) &&
					!state.pending.some(
						(op) => op.coords.x === tile.x && op.coords.y === tile.y && op.type === 'reveal'
					)
				) {
					return {
						...state,
						revealed: [...state.revealed, {
							x: tile.x,
							y: tile.y,
							alwaysRevealed: tile.alwaysRevealed || false,
							revealedAt: tile.revealedAt ? new Date(tile.revealedAt) : new Date()
						}]
					};
				}
				return state;
			});
		});

		campaignState.addEventListener('tile-hidden', (tile: Pick<TileCoords, 'x' | 'y'>) => {
			update((state) => ({
				...state,
				revealed: state.revealed.filter((t) => !(t.x === tile.x && t.y === tile.y)),
				// Also remove any pending operations for this tile since it's now definitively hidden
				pending: state.pending.filter((op) => !(op.coords.x === tile.x && op.coords.y === tile.y))
			}));
		});
	}

	let batchTimeout: number | null = null;
	const BATCH_DELAY = 1000; // Wait 1 second before sending batch

	// Check if tile is revealed (including optimistic updates)
	function isTileRevealed(coords: TileCoords, state: TileState): boolean {
		// Check if it's in revealed tiles
		const isRevealed = state.revealed.some((tile) => tile.x === coords.x && tile.y === coords.y);

		// Check pending operations
		const pendingReveal = state.pending.find(
			(op) => op.coords.x === coords.x && op.coords.y === coords.y && op.type === 'reveal'
		);
		const pendingHide = state.pending.find(
			(op) => op.coords.x === coords.x && op.coords.y === coords.y && op.type === 'hide'
		);

		if (pendingReveal && !pendingHide) return true;
		if (pendingHide && !pendingReveal) return false;
		if (pendingReveal && pendingHide) {
			// If both exist, use the most recent
			return pendingReveal.timestamp > pendingHide.timestamp;
		}

		return isRevealed;
	}

	// Process pending operations in batches
	async function processBatch() {
		update((state) => {
			if (state.pending.length === 0) return state;

			// Group operations by type and alwaysRevealed flag
			const reveals = state.pending.filter((op) => op.type === 'reveal' && !op.alwaysRevealed);
			const alwaysReveals = state.pending.filter((op) => op.type === 'reveal' && op.alwaysRevealed);
			const hides = state.pending.filter((op) => op.type === 'hide');

			// Clear pending before processing
			const pendingOps = [...state.pending];
			const newState = { ...state, pending: [] };

			// Process in background
			Promise.all([
				reveals.length > 0
					? processBatchOperation(
							'reveal',
							reveals.map((op) => op.coords),
							false
						)
					: Promise.resolve(),
				alwaysReveals.length > 0
					? processBatchOperation(
							'reveal',
							alwaysReveals.map((op) => op.coords),
							true
						)
					: Promise.resolve(),
				hides.length > 0
					? processBatchOperation(
							'hide',
							hides.map((op) => op.coords)
						)
					: Promise.resolve()
			]).catch((error) => {
				console.error('Batch operation failed:', error);
				// Rollback on failure
				update((currentState) => ({
					...currentState,
					pending: [...currentState.pending, ...pendingOps],
					errors: [
						...currentState.errors,
						{
							coords: { x: -1, y: -1 },
							message: 'Batch operation failed. Retrying...'
						}
					]
				}));
			});

			return newState;
		});
	}

	async function processBatchOperation(type: 'reveal' | 'hide' | 'toggle-always-revealed', coords: TileCoords[], alwaysRevealed?: boolean) {
		const response = await fetch(`/api/campaigns/${campaignSlug}/tiles/batch`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ type, tiles: coords, alwaysRevealed })
		});

		if (!response.ok) {
			throw new Error(`Failed to ${type} tiles`);
		}

		// Update the actual revealed state on success
		update((state) => {
			let newRevealed = [...state.revealed];

			if (type === 'reveal') {
				// Add tiles that aren't already revealed
				coords.forEach((coord) => {
					if (!newRevealed.some((tile) => tile.x === coord.x && tile.y === coord.y)) {
						newRevealed.push({
							x: coord.x,
							y: coord.y,
							alwaysRevealed: alwaysRevealed || false,
							revealedAt: new Date()
						});
					}
				});
			} else {
				// Remove tiles
				newRevealed = newRevealed.filter(
					(tile) => !coords.some((coord) => coord.x === tile.x && coord.y === tile.y)
				);
			}

			return { ...state, revealed: newRevealed };
		});
	}

	function scheduleBatch() {
		if (batchTimeout) {
			clearTimeout(batchTimeout);
		}

		batchTimeout = window.setTimeout(() => {
			processBatch();
			batchTimeout = null;
		}, BATCH_DELAY);
	}

	return {
		subscribe,

		// Optimistic reveal
		revealTile: (coords: TileCoords) => {
			update((state) => {
				// Don't add if already revealed or pending reveal
				if (isTileRevealed(coords, state)) return state;

				const newPending = state.pending.filter(
					(op) => !(op.coords.x === coords.x && op.coords.y === coords.y)
				);

				return {
					...state,
					pending: [...newPending, { type: 'reveal', coords, timestamp: Date.now() }],
					errors: state.errors.filter(
						(err) => !(err.coords.x === coords.x && err.coords.y === coords.y)
					)
				};
			});

			scheduleBatch();
		},

		// Optimistic hide
		hideTile: (coords: TileCoords) => {
			update((state) => {
				// Don't add if already hidden or pending hide
				if (!isTileRevealed(coords, state)) return state;

				const newPending = state.pending.filter(
					(op) => !(op.coords.x === coords.x && op.coords.y === coords.y)
				);

				return {
					...state,
					pending: [...newPending, { type: 'hide', coords, timestamp: Date.now() }],
					errors: state.errors.filter(
						(err) => !(err.coords.x === coords.x && err.coords.y === coords.y)
					)
				};
			});

			scheduleBatch();
		},

		// Batch operations
		revealTiles: (tiles: TileCoords[], alwaysRevealed: boolean = false) => {
			// If always-revealed, delegate to campaign state for optimistic updates
			if (alwaysRevealed && campaignState && 'revealTiles' in campaignState) {
				campaignState.revealTiles(tiles, alwaysRevealed);
				return;
			}

			update((state) => {
				const newPending = [...state.pending];
				const timestamp = Date.now();

				tiles.forEach((coords) => {
					if (!isTileRevealed(coords, state)) {
						// Remove any existing operations for this tile
						const filtered = newPending.filter(
							(op) => !(op.coords.x === coords.x && op.coords.y === coords.y)
						);
						filtered.push({ type: 'reveal', coords, timestamp, alwaysRevealed });
						newPending.length = 0;
						newPending.push(...filtered);
					}
				});

				return {
					...state,
					pending: newPending,
					errors: []
				};
			});

			scheduleBatch();
		},

		hideTiles: (tiles: TileCoords[]) => {
			update((state) => {
				const newPending = [...state.pending];
				const timestamp = Date.now();

				tiles.forEach((coords) => {
					if (isTileRevealed(coords, state)) {
						// Remove any existing operations for this tile
						const filtered = newPending.filter(
							(op) => !(op.coords.x === coords.x && op.coords.y === coords.y)
						);
						filtered.push({ type: 'hide', coords, timestamp });
						newPending.length = 0;
						newPending.push(...filtered);
					}
				});

				return {
					...state,
					pending: newPending,
					errors: []
				};
			});

			scheduleBatch();
		},

		// Toggle always-revealed status
		toggleAlwaysRevealed: (tiles: TileCoords[], alwaysRevealed: boolean) => {
			// Update local state optimistically
			update((state) => {
				const newRevealed = [...state.revealed];
				
				tiles.forEach((tileCoords) => {
					const existingIndex = newRevealed.findIndex(
						(tile) => tile.x === tileCoords.x && tile.y === tileCoords.y
					);
					
					if (existingIndex !== -1) {
						// Update existing tile
						newRevealed[existingIndex] = {
							...newRevealed[existingIndex],
							alwaysRevealed
						};
					} else if (alwaysRevealed) {
						// Add new always-revealed tile
						newRevealed.push({
							x: tileCoords.x,
							y: tileCoords.y,
							alwaysRevealed: true,
							revealedAt: new Date()
						});
					}
				});
				
				return { ...state, revealed: newRevealed };
			});

			// Delegate to campaign state for server sync
			if (campaignState && 'toggleAlwaysRevealed' in campaignState) {
				campaignState.toggleAlwaysRevealed(tiles, alwaysRevealed);
			} else {
				console.error('Campaign state not available or does not support always-revealed operations');
			}
		},

		// Force immediate batch processing
		flush: () => {
			if (batchTimeout) {
				clearTimeout(batchTimeout);
				batchTimeout = null;
			}
			processBatch();
		},

		// Get current revealed tiles including optimistic updates
		getRevealedTiles: (state: TileState) => {
			let revealed = [...state.revealed];

			// Apply pending operations chronologically
			const sortedPending = [...state.pending].sort((a, b) => a.timestamp - b.timestamp);

			sortedPending.forEach((op) => {
				if (op.type === 'reveal') {
					if (!revealed.some((tile) => tile.x === op.coords.x && tile.y === op.coords.y)) {
						revealed.push({
							x: op.coords.x,
							y: op.coords.y,
							alwaysRevealed: op.alwaysRevealed || false,
							revealedAt: new Date()
						});
					}
				} else {
					revealed = revealed.filter((tile) => !(tile.x === op.coords.x && tile.y === op.coords.y));
				}
			});

			return revealed;
		},

		// Check if tile is revealed (including optimistic)
		isRevealed: (coords: TileCoords, state: TileState) => isTileRevealed(coords, state),

		// Clear errors
		clearErrors: () => {
			update((state) => ({ ...state, errors: [] }));
		}
	};
}

export { createTileManager, type TileState };
