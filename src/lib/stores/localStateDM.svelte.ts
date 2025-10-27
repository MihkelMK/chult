import type {
	CampaignDataResponse,
	GameSessionResponse,
	MapMarkerResponse,
	PathResponse,
	PathStep,
	RevealedTileResponse
} from '$lib/types';
import { untrack } from 'svelte';
import { SvelteDate, SvelteMap, SvelteSet } from 'svelte/reactivity';
import { LocalState } from './localState.svelte';

export class LocalStateDM extends LocalState {
	// Public reactive Sets - UI source of truth
	public revealedTilesSet = $state(new SvelteSet<string>());
	public alwaysRevealedTilesSet = $state(new SvelteSet<string>());

	constructor(initialData: CampaignDataResponse, campaignSlug: string) {
		super(initialData, campaignSlug);

		// Initialize Sets and markers map using base class methods
		this.initializeRevealedTileSets(initialData.revealedTiles);
		this.initializeMarkersMap(initialData.mapMarkers);

		// Event listeners for synchronization
		this.addEventListener('tiles-revealed-batch', (tiles) =>
			this.handleTilesRevealedBatch(tiles as RevealedTileResponse[])
		);
		this.addEventListener('tile-hidden', (tile) =>
			super.handleTileHidden(tile as Pick<RevealedTileResponse, 'x' | 'y'>)
		);
		this.addEventListener('marker-created', (marker) =>
			super.handleMarkerCreated(marker as MapMarkerResponse)
		);
		this.addEventListener('marker-updated', (marker) =>
			super.handleMarkerUpdated(marker as MapMarkerResponse)
		);
		this.addEventListener('marker-deleted', (data) =>
			super.handleMarkerDeleted((data as { id: number }).id)
		);

		// Exploration event listeners (NEW)
		this.addEventListener('session:started', (session) =>
			this.handleSessionStarted(session as GameSessionResponse)
		);
		this.addEventListener('session:ended', (session) =>
			this.handleSessionEnded(session as GameSessionResponse)
		);
		this.addEventListener('movement:step-added', (data) =>
			this.handleMovementStepAdded(data as { sessionId: number; step: PathStep; tiles: string[] })
		);
		this.addEventListener('time:updated', (data) =>
			this.handleTimeUpdated(data as { globalGameTime: number })
		);
		this.addEventListener('session:deleted', (data) =>
			this.handleSessionDeleted(data as { id: number })
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
			updatedAt: new SvelteDate(),
			authorRole: 'dm'
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

	// Exploration event handlers (NEW)
	private handleSessionStarted(session: GameSessionResponse) {
		console.log('[localStateDM] SSE session:started', session);

		// Check if session already exists (from optimistic update)
		const existingIndex = this.gameSessions.findIndex((s) => s.id === session.id);
		if (existingIndex !== -1) {
			// Update existing session
			this.gameSessions[existingIndex] = session;
		} else {
			// Add new session
			this.gameSessions.push(session);
		}

		// Create empty path for this session
		const newPath: PathResponse = {
			id: session.id, // Path ID matches session ID for simplicity
			gameSessionId: session.id,
			steps: [],
			revealedTiles: []
		};
		this.pathsMap.set(session.id, newPath);
	}

	private handleSessionEnded(session: GameSessionResponse) {
		console.log('[localStateDM] SSE session:ended', session);

		// Update session in array
		const index = this.gameSessions.findIndex((s) => s.id === session.id);
		if (index !== -1) {
			this.gameSessions[index] = session;
		}
	}

	private handleMovementStepAdded(data: { sessionId: number; step: PathStep; tiles: string[] }) {
		console.log('[localStateDM] SSE movement:step-added', data);

		const path = this.pathsMap.get(data.sessionId);
		if (!path) {
			console.warn('[localStateDM] Path not found for session', data.sessionId);
			return;
		}

		// Check if step already exists (from optimistic update)
		const stepExists = path.steps.some((s) => this.stepsEqual(s, data.step));
		if (stepExists) {
			console.log('[localStateDM] Step already exists (optimistic)');
			return;
		}

		// Add step to path
		path.steps.push(data.step);

		// Add revealed tiles to path
		data.tiles.forEach((tileKey) => {
			if (!path.revealedTiles.includes(tileKey)) {
				path.revealedTiles.push(tileKey);
			}
		});

		// Update party token position
		const destination = this.getStepDestination(data.step);
		if (destination) {
			const [col, row] = destination.split('-').map(Number);
			this.partyTokenPosition = { x: col, y: row };
		}

		// Update global game time from step
		this.globalGameTime = data.step.gameTime;

		// Force reactivity
		this.pathsMap = new SvelteMap(this.pathsMap);
	}

	private handleTimeUpdated(data: { globalGameTime: number }) {
		console.log('[localStateDM] SSE time:updated', data);
		this.globalGameTime = data.globalGameTime;
	}

	private handleSessionDeleted(data: { id: number }) {
		console.log('[localStateDM] SSE session:deleted', data);

		// Remove session from array
		this.gameSessions = this.gameSessions.filter((s) => s.id !== data.id);

		// Remove associated path
		this.pathsMap.delete(data.id);
		this.pathsMap = new SvelteMap(this.pathsMap);
	}

	// Helper methods

	private stepsEqual(a: PathStep, b: PathStep): boolean {
		if (a.type !== b.type) return false;

		switch (a.type) {
			case 'player_move':
				return (
					b.type === 'player_move' &&
					a.tileKey === b.tileKey &&
					Math.abs(a.gameTime - b.gameTime) < 0.001
				);
			case 'dm_teleport':
				return (
					b.type === 'dm_teleport' &&
					a.fromTile === b.fromTile &&
					a.toTile === b.toTile &&
					Math.abs(a.gameTime - b.gameTime) < 0.001
				);
			case 'dm_path':
				return (
					b.type === 'dm_path' &&
					a.tiles.length === b.tiles.length &&
					a.tiles.every((t, i) => t === b.tiles[i]) &&
					Math.abs(a.gameTime - b.gameTime) < 0.001
				);
			default:
				return false;
		}
	}

	private getStepDestination(step: PathStep): string | null {
		switch (step.type) {
			case 'player_move':
				return step.tileKey;
			case 'dm_teleport':
				return step.toTile;
			case 'dm_path':
				return step.tiles[step.tiles.length - 1] || null;
			default:
				return null;
		}
	}
}
