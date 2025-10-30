import type {
	CampaignDataResponse,
	GameSessionResponse,
	MapMarkerResponse,
	PathStep,
	RevealedTileResponse,
	TimeAuditLogResponse
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

		// Initialize time audit log (DM only)
		this.timeAuditLog = initialData.timeAuditLog || [];

		// Event listeners for synchronization
		this.addEventListener('tiles:revealed:batch', (tiles) =>
			this.handleTilesRevealedBatch(tiles as RevealedTileResponse[])
		);
		this.addEventListener('tile:hidden', (tile) =>
			super.handleTileHidden(tile as Pick<RevealedTileResponse, 'x' | 'y'>)
		);
		this.addEventListener('marker:created', (marker) =>
			super.handleMarkerCreated(marker as MapMarkerResponse)
		);
		this.addEventListener('marker:updated', (marker) =>
			super.handleMarkerUpdated(marker as MapMarkerResponse)
		);
		this.addEventListener('marker:deleted', (data) =>
			super.handleMarkerDeleted((data as { id: number }).id)
		);

		// Exploration event listeners (NEW)
		this.addEventListener('movement:step-added', (data) =>
			super.handleMovementStepAdded(data as { sessionId: number; step: PathStep; tiles: string[] })
		);
		this.addEventListener('time:updated', (data) =>
			this.handleTimeUpdated(data as { globalGameTime: number; auditEntry?: TimeAuditLogResponse })
		);
		this.addEventListener('session:started', (session) =>
			super.handleSessionStarted(session as GameSessionResponse)
		);
		this.addEventListener('session:ended', (session) =>
			super.handleSessionEnded(session as GameSessionResponse)
		);
		this.addEventListener('session:deleted', (data) =>
			super.handleSessionDeleted(data as { id: number })
		);
	}

	// Override handleTimeUpdated to also handle audit log entries (DM only)
	protected handleTimeUpdated(data: { globalGameTime: number; auditEntry?: TimeAuditLogResponse }) {
		this.globalGameTime = data.globalGameTime;

		// Add audit log entry (avoiding duplicates from API response)
		if (data.auditEntry) {
			const exists = this.timeAuditLog.some((entry) => entry.id === data.auditEntry!.id);

			if (!exists) {
				this.timeAuditLog = [data.auditEntry, ...this.timeAuditLog];
			}
		}
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
}
