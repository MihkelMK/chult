import type { TileCoords } from '$lib/types';
import { SvelteSet } from 'svelte/reactivity';
import type { LocalStateDM } from './localStateDM.svelte';

interface PendingOperation {
	type: 'reveal' | 'hide' | 'toggleAlwaysRevealed';
	coords: TileCoords;
	timestamp: number;
	alwaysRevealed?: boolean;
}

export interface RevealedTile extends TileCoords {
	alwaysRevealed: boolean;
	revealedAt: Date;
}

interface ErrorInfo {
	coords: TileCoords;
	message: string;
}

export class RemoteStateDM {
	// Public reactive state
	public pending = $state<PendingOperation[]>([]);
	public errors = $state<ErrorInfo[]>([]);

	private campaignSlug: string;
	private localState?: LocalStateDM;
	private batchTimeout: number | null = null;
	private readonly BATCH_DELAY = 50; // Wait 50ms before sending batch

	constructor(campaignSlug: string, localState?: LocalStateDM) {
		this.campaignSlug = campaignSlug;
		this.localState = localState;

		// Connect to local state events if available
		if (localState) {
			localState.addEventListener('tile:revealed', (tile: TileCoords | RevealedTile) => {
				// Remove from pending if this was from our optimistic update
				this.pending = this.pending.filter(
					(op) => !(op.coords.x === tile.x && op.coords.y === tile.y && op.type === 'reveal')
				);
			});

			localState.addEventListener('tile:hidden', (tile: Pick<TileCoords, 'x' | 'y'>) => {
				// Remove any pending operations for this tile since it's now definitively hidden
				this.pending = this.pending.filter(
					(op) => !(op.coords.x === tile.x && op.coords.y === tile.y)
				);
			});
		}
	}

	// Check if tile is revealed (including optimistic updates)
	private isTileRevealed(coords: TileCoords): boolean {
		if (!this.localState) return false;

		const key = `${coords.x}-${coords.y}`;
		const isInSets =
			this.localState.revealedTilesSet.has(key) || this.localState.alwaysRevealedTilesSet.has(key);

		// Check pending operations
		const pendingReveal = this.pending.find(
			(op) => op.coords.x === coords.x && op.coords.y === coords.y && op.type === 'reveal'
		);
		const pendingHide = this.pending.find(
			(op) => op.coords.x === coords.x && op.coords.y === coords.y && op.type === 'hide'
		);

		if (pendingReveal && !pendingHide) return true;
		if (pendingHide && !pendingReveal) return false;
		if (pendingReveal && pendingHide) {
			// If both exist, use the most recent
			return pendingReveal.timestamp > pendingHide.timestamp;
		}

		return isInSets;
	}

	// Process pending operations in batches
	private async processBatch() {
		if (this.pending.length === 0) return;

		// Group operations by type and alwaysRevealed flag
		const reveals = this.pending.filter((op) => op.type === 'reveal' && !op.alwaysRevealed);
		const alwaysReveals = this.pending.filter((op) => op.type === 'reveal' && op.alwaysRevealed);
		const hides = this.pending.filter((op) => op.type === 'hide');
		const togglesToAlways = this.pending.filter(
			(op) => op.type === 'toggleAlwaysRevealed' && op.alwaysRevealed
		);
		const togglesFromAlways = this.pending.filter(
			(op) => op.type === 'toggleAlwaysRevealed' && !op.alwaysRevealed
		);

		// Save pending operations for rollback
		const pendingOps = [...this.pending];

		// Clear pending before processing
		this.pending = [];

		try {
			// Process in parallel
			await Promise.all([
				reveals.length > 0
					? this.processBatchOperation(
							'reveal',
							reveals.map((op) => op.coords),
							false
						)
					: Promise.resolve(),
				alwaysReveals.length > 0
					? this.processBatchOperation(
							'reveal',
							alwaysReveals.map((op) => op.coords),
							true
						)
					: Promise.resolve(),
				hides.length > 0
					? this.processBatchOperation(
							'hide',
							hides.map((op) => op.coords)
						)
					: Promise.resolve(),
				togglesToAlways.length > 0
					? this.processBatchOperation(
							'toggle-always-revealed',
							togglesToAlways.map((op) => op.coords),
							true
						)
					: Promise.resolve(),
				togglesFromAlways.length > 0
					? this.processBatchOperation(
							'toggle-always-revealed',
							togglesFromAlways.map((op) => op.coords),
							false
						)
					: Promise.resolve()
			]);
		} catch (error) {
			console.error('Batch operation failed:', error);
			// Rollback on failure
			this.pending = [...this.pending, ...pendingOps];
			this.errors = [
				...this.errors,
				{
					coords: { x: -1, y: -1 },
					message: 'Batch operation failed. Retrying...'
				}
			];
		}
	}

	private async processBatchOperation(
		type: 'reveal' | 'hide' | 'toggle-always-revealed',
		coords: TileCoords[],
		alwaysRevealed?: boolean
	) {
		const url = `/api/campaigns/${this.campaignSlug}/tiles/batch`;
		const body = { type, tiles: coords, alwaysRevealed };

		const response = await fetch(url, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(body)
		});

		if (!response.ok) {
			const errorText = await response.text();
			console.error(`[remoteState] API call failed:`, {
				status: response.status,
				statusText: response.statusText,
				errorText
			});
			throw new Error(`Failed to ${type} tiles: ${response.status} ${errorText}`);
		}

		return response.json();
	}

	private scheduleBatch() {
		if (this.batchTimeout) {
			clearTimeout(this.batchTimeout);
		}

		this.batchTimeout = window.setTimeout(() => {
			this.processBatch();
			this.batchTimeout = null;
		}, this.BATCH_DELAY);
	}

	// Public API methods

	revealTile(coords: TileCoords) {
		// Don't add if already revealed or pending reveal
		if (this.isTileRevealed(coords)) return;

		// Optimistically update localState Sets if available
		if (this.localState && 'revealedTilesSet' in this.localState) {
			const key = `${coords.x}-${coords.y}`;
			this.localState.revealedTilesSet.add(key);
		}

		// Remove any existing operations for this tile
		this.pending = this.pending.filter(
			(op) => !(op.coords.x === coords.x && op.coords.y === coords.y)
		);

		// Add reveal operation
		this.pending.push({ type: 'reveal', coords, timestamp: Date.now() });

		// Clear errors for this tile
		this.errors = this.errors.filter(
			(err) => !(err.coords.x === coords.x && err.coords.y === coords.y)
		);

		this.scheduleBatch();
	}

	hideTile(coords: TileCoords) {
		// Don't add if already hidden or pending hide
		if (!this.isTileRevealed(coords)) return;

		// Optimistically update localState Sets if available
		if (this.localState && 'revealedTilesSet' in this.localState) {
			const key = `${coords.x}-${coords.y}`;
			this.localState.revealedTilesSet.delete(key);
			this.localState.alwaysRevealedTilesSet.delete(key);
		}

		// Remove any existing operations for this tile
		this.pending = this.pending.filter(
			(op) => !(op.coords.x === coords.x && op.coords.y === coords.y)
		);

		// Add hide operation
		this.pending.push({ type: 'hide', coords, timestamp: Date.now() });

		// Clear errors for this tile
		this.errors = this.errors.filter(
			(err) => !(err.coords.x === coords.x && err.coords.y === coords.y)
		);

		this.scheduleBatch();
	}

	revealTiles(tiles: TileCoords[], alwaysRevealed: boolean = false) {
		// IMPORTANT: Check which tiles need API updates BEFORE optimistic update
		const timestamp = Date.now();
		const tilesToRevealSet = new SvelteSet(tiles.map((t) => `${t.x}-${t.y}`));

		// Remove existing pending operations for these tiles
		this.pending = this.pending.filter(
			(op) => !tilesToRevealSet.has(`${op.coords.x}-${op.coords.y}`)
		);

		// Add new pending operations (BEFORE optimistic update so isTileRevealed works correctly)
		tiles.forEach((coords) => {
			if (!this.isTileRevealed(coords)) {
				this.pending.push({ type: 'reveal', coords, timestamp, alwaysRevealed });
			}
		});

		// NOW do the optimistic local state update
		if (this.localState && 'updateRevealedTiles' in this.localState) {
			this.localState.updateRevealedTiles(tiles, alwaysRevealed);
		}

		this.errors = [];

		this.scheduleBatch();
	}

	hideTiles(tiles: TileCoords[]) {
		// IMPORTANT: Check which tiles need API updates BEFORE optimistic update
		const timestamp = Date.now();
		const tilesToHideSet = new SvelteSet(tiles.map((t) => `${t.x}-${t.y}`));

		// Remove pending operations for tiles we're about to hide
		this.pending = this.pending.filter(
			(op) => !tilesToHideSet.has(`${op.coords.x}-${op.coords.y}`)
		);

		// Add hide operations for tiles that are currently revealed (BEFORE optimistic update)
		tiles.forEach((coords) => {
			if (this.isTileRevealed(coords)) {
				this.pending.push({ type: 'hide', coords, timestamp });
			}
		});

		// NOW do the optimistic local state update
		if (this.localState && 'updateHiddenTiles' in this.localState) {
			this.localState.updateHiddenTiles(tiles);
		}

		this.scheduleBatch();
	}

	toggleAlwaysRevealed(tiles: TileCoords[], alwaysRevealed: boolean) {
		// IMPORTANT: Add to pending BEFORE optimistic update
		const timestamp = Date.now();
		const tilesToToggleSet = new SvelteSet(tiles.map((t) => `${t.x}-${t.y}`));

		// Remove pending operations for tiles we're about to toggle
		this.pending = this.pending.filter(
			(op) => !tilesToToggleSet.has(`${op.coords.x}-${op.coords.y}`)
		);

		// Add toggle operations (BEFORE optimistic update)
		tiles.forEach((coords) => {
			this.pending.push({
				type: 'toggleAlwaysRevealed',
				coords,
				timestamp,
				alwaysRevealed
			});
		});

		// NOW do the optimistic local state update
		if (this.localState && 'updateToggledAlwaysRevealed' in this.localState) {
			this.localState.updateToggledAlwaysRevealed(tiles, alwaysRevealed);
		}

		this.scheduleBatch();
	}

	// Exploration methods (NEW)
	async startSession() {
		if (!this.localState) {
			throw new Error('Local state not available');
		}

		try {
			const response = await fetch(`/api/campaigns/${this.campaignSlug}/sessions/start`, {
				method: 'POST'
			});

			if (!response.ok) {
				const errorData = await response.json();
				throw new Error(errorData.message || 'Failed to start session');
			}

			const session = await response.json();
			console.log('[remoteStateDM] Session started:', session);

			// SSE will handle the state update
			return session;
		} catch (error) {
			console.error('[remoteStateDM] Failed to start session:', error);
			throw error;
		}
	}

	async endSession() {
		if (!this.localState) {
			throw new Error('Local state not available');
		}

		const activeSession = this.localState.activeSession;
		if (!activeSession) {
			throw new Error('No active session');
		}

		try {
			const response = await fetch(`/api/campaigns/${this.campaignSlug}/sessions/end`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' }
			});

			if (!response.ok) {
				const errorData = await response.json();
				throw new Error(errorData.message || 'Failed to end session');
			}

			const session = await response.json();
			console.log('[remoteStateDM] Session ended:', session);

			// SSE will handle the state update
			return session;
		} catch (error) {
			console.error('[remoteStateDM] Failed to end session:', error);
			throw error;
		}
	}

	async deleteSession(sessionId: number) {
		try {
			const response = await fetch(`/api/campaigns/${this.campaignSlug}/sessions/${sessionId}`, {
				method: 'DELETE',
				headers: { 'Content-Type': 'application/json' }
			});

			if (!response.ok) {
				const errorData = await response.json();
				throw new Error(errorData.message || 'Failed to delete session');
			}

			const session = await response.json();
			console.log('[remoteStateDM] Session deleted:', session);

			// SSE will handle the state update
			return session;
		} catch (error) {
			console.error('[remoteStateDM] Failed to delete session:', error);
			throw error;
		}
	}

	async addDMTeleport(from: TileCoords, to: TileCoords, timeCost: number) {
		if (!this.localState) {
			throw new Error('Local state not available');
		}

		const activeSession = this.localState.activeSession;
		if (!activeSession) {
			throw new Error('No active session');
		}

		// Optimistic update - update party position immediately
		const originalPosition = this.localState.partyTokenPosition;
		this.localState.partyTokenPosition = to;

		try {
			const response = await fetch(`/api/campaigns/${this.campaignSlug}/movement/dm/teleport`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ from, to, timeCost })
			});

			if (!response.ok) {
				const errorData = await response.json();
				throw new Error(errorData.message || 'Failed to teleport');
			}

			const result = await response.json();
			console.log('[remoteStateDM] Teleport successful:', result);

			// SSE will handle the complete state update
			return result;
		} catch (error) {
			// Rollback optimistic update on failure
			this.localState.partyTokenPosition = originalPosition;
			console.error('[remoteStateDM] Failed to teleport:', error);
			throw error;
		}
	}

	async adjustGlobalTime(delta: number, notes: string = '') {
		if (!this.localState) {
			throw new Error('Local state not available');
		}

		// Optimistic update - update global game time immediately
		const originalGameTime = this.localState.globalGameTime;
		this.localState.globalGameTime += delta;

		try {
			const response = await fetch(`/api/campaigns/${this.campaignSlug}/time/adjust`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ delta, notes })
			});

			if (!response.ok) {
				const errorData = await response.json();
				throw new Error(errorData.message || 'Failed to adjust time');
			}

			const result = await response.json();
			console.log('[remoteStateDM] Time adjustment successful:', result);

			// Add the audit entry immediately from API response (SSE will be deduplicated)
			const exists = this.localState.timeAuditLog.some(
				(entry) => entry.id === result.auditEntry.id
			);
			if (!exists) {
				this.localState.timeAuditLog = [result.auditEntry, ...this.localState.timeAuditLog];
			}

			return result;
		} catch (error) {
			// Rollback optimistic update on failure
			this.localState.globalGameTime = originalGameTime;
			console.error('[remoteStateDM] Failed to adjust time:', error);
			throw error;
		}
	}

	flush() {
		if (this.batchTimeout) {
			clearTimeout(this.batchTimeout);
			this.batchTimeout = null;
		}
		this.processBatch();
	}

	clearErrors() {
		this.errors = [];
	}
}
