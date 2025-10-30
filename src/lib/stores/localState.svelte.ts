import { browser } from '$app/environment';
import type {
	CampaignDataResponse,
	GameSessionResponse,
	MapMarkerResponse,
	PathResponse,
	PathStep,
	PlayerCampaignDataResponse,
	RevealedTile,
	TileCoords,
	TimeAuditLogResponse,
	UserRole
} from '$lib/types';
import EventEmitter from 'eventemitter3';
import { SvelteDate, SvelteMap, SvelteSet } from 'svelte/reactivity';

// Define a type for the event listener to ensure type safety
type EventListener<T> = (data: T) => void;

export class LocalState extends EventEmitter {
	public campaign: CampaignDataResponse | PlayerCampaignDataResponse;
	private campaignSlug: string;
	private eventSource: EventSource | null = null;

	// Hover state management
	public hoveredTile = $state<TileCoords | null>(null);

	// Empty sets for typescript (overridden in subclasses)
	public revealedTilesSet = new SvelteSet<string>();
	public alwaysRevealedTilesSet = new SvelteSet<string>();

	// Markers maps for O(1) lookups (shared between DM and Player)
	public markersById = $state(new SvelteMap<number, MapMarkerResponse>()); // Key: marker.id (for SSE handlers)

	// Derived map for O(1) tile-based lookups (automatically synced from markersById)
	public markersByTile = $derived.by(() => {
		const byTile = new SvelteMap<string, MapMarkerResponse>();
		this.markersById.forEach((marker) => {
			byTile.set(`${marker.x}-${marker.y}`, marker);
		});
		return byTile;
	});

	// Exploration state (NEW)
	public globalGameTime = $state(0); // Days as float
	public gameSessions = $state<GameSessionResponse[]>([]);
	public pathsMap = $state(new SvelteMap<number, PathResponse>()); // gameSessionId -> PathResponse
	public partyTokenPosition = $state<TileCoords | null>(null);
	public partyTokenTile = $derived<string | null>(
		this.partyTokenPosition ? `${this.partyTokenPosition.x}-${this.partyTokenPosition.y}` : null
	);

	// Empty array for typescript (overridden in localStateDM)
	public timeAuditLog = $state<TimeAuditLogResponse[]>([]);

	// Hex grid configuration (reactive so we can update if settings change)
	protected hexesPerRow = $state(0);
	protected hexesPerCol = $state(0);
	protected imageWidth = $state(0);
	protected imageHeight = $state(0);
	protected xOffset = $state(0);
	protected yOffset = $state(0);

	// Derived hex calculations
	public hexRadius = $derived.by(() => {
		return (this.imageWidth - this.xOffset * 2) / (this.hexesPerRow * 1.5 + 0.5);
	});

	protected hexHeight = $derived.by(() => {
		return (this.imageHeight - this.yOffset * 2) / this.hexesPerCol;
	});

	protected horizontalSpacing = $derived(this.hexRadius * 1.5);
	protected verticalSpacing = $derived(this.hexHeight);

	// Derived exploration properties
	public activeSession = $derived.by(() => {
		return this.gameSessions.find((s) => s.isActive) ?? null;
	});

	public currentPath = $derived.by(() => {
		if (!this.activeSession) return null;
		return this.pathsMap.get(this.activeSession.id) ?? null;
	});

	// Version counter to force reactivity when Sets change
	public tilesVersion = $state(0);
	public markersVersion = $state(0);

	constructor(
		initialData: CampaignDataResponse | PlayerCampaignDataResponse,
		campaignSlug: string
	) {
		super();
		this.campaign = $state(initialData);
		this.campaignSlug = campaignSlug;

		// Initialize hex grid configuration from campaign data
		this.hexesPerRow = initialData.campaign.hexesPerRow;
		this.hexesPerCol = initialData.campaign.hexesPerCol;
		this.imageWidth = initialData.campaign.imageWidth;
		this.imageHeight = initialData.campaign.imageHeight;
		this.xOffset = initialData.campaign.hexOffsetX;
		this.yOffset = initialData.campaign.hexOffsetY + 50;

		// Initialize exploration state (NEW)
		this.globalGameTime = initialData.campaign.globalGameTime;
		if (initialData.campaign.partyTokenX !== null && initialData.campaign.partyTokenY !== null) {
			this.partyTokenPosition = {
				x: initialData.campaign.partyTokenX,
				y: initialData.campaign.partyTokenY
			};
		}
		this.gameSessions = initialData.gameSessions || [];
		this.initializePathsMap(initialData.paths || []);

		if (browser) {
			this.connect();
		}
	}

	private connect() {
		if (this.eventSource) {
			return;
		}

		const url = `/api/campaigns/${this.campaignSlug}/events`;
		this.eventSource = new EventSource(url);

		this.eventSource.onmessage = () => {
			// This handles the keep-alive messages
		};

		this.eventSource.onerror = (err) => {
			console.error('[localState] EventSource failed:', err);
			this.eventSource?.close();
			// Optional: implement reconnection logic here
		};

		// Register listeners for specific event types
		this.eventSource.addEventListener('tile:revealed', (event) => {
			try {
				const tiles = JSON.parse(event.data);
				// Handle both single tiles and arrays for backwards compatibility
				const tilesArray = Array.isArray(tiles) ? tiles : [tiles];
				// Emit the entire array at once for batch processing
				this.emit('tiles:revealed:batch', tilesArray);
			} catch (error) {
				console.error('Failed to parse tile:revealed event:', error);
			}
		});

		this.eventSource.addEventListener('marker:created', (event) => {
			try {
				const marker = JSON.parse(event.data);
				this.emit('marker:created', marker);
			} catch (error) {
				console.error('Failed to parse marker:created event:', error);
			}
		});

		this.eventSource.addEventListener('marker:updated', (event) => {
			try {
				const marker = JSON.parse(event.data);
				this.emit('marker:updated', marker);
			} catch (error) {
				console.error('Failed to parse marker:updated event:', error);
			}
		});

		this.eventSource.addEventListener('marker:deleted', (event) => {
			try {
				const data = JSON.parse(event.data);
				this.emit('marker:deleted', data);
			} catch (error) {
				console.error('Failed to parse marker:deleted event:', error);
			}
		});

		this.eventSource.addEventListener('tile:hidden', (event) => {
			try {
				const tiles = JSON.parse(event.data);
				// Handle both single tiles and arrays for consistency
				const tilesArray = Array.isArray(tiles) ? tiles : [tiles];
				tilesArray.forEach((tile) => this.emit('tile:hidden', tile));
			} catch (error) {
				console.error('Failed to parse tile:hidden event:', error);
			}
		});

		// Exploration SSE listeners (NEW)
		this.eventSource.addEventListener('session:started', (event) => {
			try {
				const session = JSON.parse(event.data);
				this.emit('session:started', session);
			} catch (error) {
				console.error('Failed to parse session:started event:', error);
			}
		});

		this.eventSource.addEventListener('session:ended', (event) => {
			try {
				const session = JSON.parse(event.data);
				this.emit('session:ended', session);
			} catch (error) {
				console.error('Failed to parse session:ended event:', error);
			}
		});

		this.eventSource.addEventListener('movement:step-added', (event) => {
			try {
				const data = JSON.parse(event.data);
				this.emit('movement:step-added', data);
			} catch (error) {
				console.error('Failed to parse movement:step-added event:', error);
			}
		});

		this.eventSource.addEventListener('movement:step-reverted', (event) => {
			try {
				const data = JSON.parse(event.data);
				this.emit('movement:step-reverted', data);
			} catch (error) {
				console.error('Failed to parse movement:step-reverted event:', error);
			}
		});

		this.eventSource.addEventListener('time:updated', (event) => {
			try {
				const data = JSON.parse(event.data);
				this.emit('time:updated', data);
			} catch (error) {
				console.error('Failed to parse time:updated event:', error);
			}
		});

		this.eventSource.addEventListener('session:deleted', (event) => {
			try {
				const data = JSON.parse(event.data);
				this.emit('session:deleted', data);
			} catch (error) {
				console.error('Failed to parse session:deleted event:', error);
			}
		});
	}

	public disconnect() {
		if (this.eventSource) {
			this.eventSource.close();
			this.eventSource = null;
		}
	}

	// Type-safe method to add an event listener
	public addEventListener<T>(event: string, listener: EventListener<T>) {
		this.on(event, listener);
	}

	// Type-safe method to remove an event listener
	public removeEventListener<T>(event: string, listener: EventListener<T>) {
		this.off(event, listener);
	}

	// Helper for making API requests and handling errors
	async makeApiRequest<T>(
		endpoint: string,
		method: 'POST' | 'PUT' | 'DELETE',
		body?: object
	): Promise<T> {
		const response = await fetch(`/api/campaigns/${this.campaignSlug}/${endpoint}`, {
			method,
			headers: { 'Content-Type': 'application/json' },
			body: body ? JSON.stringify(body) : undefined
		});

		if (!response.ok) {
			const errorData = await response.json();
			throw new Error(errorData.message || `API request failed: ${response.statusText}`);
		}

		// For DELETE requests, a 204 No Content response is expected
		if (response.status === 204) {
			return null as T;
		}

		return response.json() as Promise<T>;
	}

	// Get markers for a specific tile with role-based filtering
	getTileMarkers(coords: TileCoords, role: UserRole) {
		if (!('mapMarkers' in this.campaign)) return [];

		const tileMarkers = this.campaign.mapMarkers.filter(
			(m) => m.x === coords.x && m.y === coords.y
		);

		// Role-based filtering
		if (role === 'dm') {
			return tileMarkers; // DM sees everything
		} else {
			// Players only see markers visible to them
			return tileMarkers.filter((m) => {
				// Player markers don't have visibleToPlayers field, they're always visible to players
				return !('visibleToPlayers' in m) || m.visibleToPlayers;
			});
		}
	}

	// Protected shared initialization methods
	protected initializeRevealedTileSets(
		tiles: (RevealedTile | Pick<RevealedTile, 'x' | 'y' | 'alwaysRevealed'>)[]
	) {
		tiles.forEach((tile) => {
			const key = `${tile.x}-${tile.y}`;
			if (tile.alwaysRevealed) {
				this.alwaysRevealedTilesSet.add(key);
			} else {
				this.revealedTilesSet.add(key);
			}
		});
	}

	protected initializeMarkersMap(markers: MapMarkerResponse[]) {
		this.markersById = new SvelteMap(markers.map((m) => [m.id, m]));
	}

	protected initializePathsMap(paths: PathResponse[]) {
		this.pathsMap = new SvelteMap(paths.map((p) => [p.gameSessionId, p]));
	}

	// Protected shared event handlers
	protected handleMarkerCreated(marker: MapMarkerResponse) {
		if (this.campaign && 'mapMarkers' in this.campaign) {
			// Check Map first for O(1) duplicate detection
			if (!this.markersById.has(marker.id)) {
				const newMarker = {
					...marker,
					createdAt: new SvelteDate(marker.createdAt),
					updatedAt: new SvelteDate(marker.updatedAt)
				} as MapMarkerResponse;
				this.markersById.set(marker.id, newMarker);
				this.campaign.mapMarkers.push(newMarker);

				// Trigger reactivity by reassigning Map
				this.markersById = new SvelteMap(this.markersById);
				this.markersVersion++;
			}
		}
	}

	protected handleMarkerUpdated(marker: MapMarkerResponse) {
		if (this.campaign && 'mapMarkers' in this.campaign) {
			// O(1) lookup in Map
			if (this.markersById.has(marker.id)) {
				const index = this.campaign.mapMarkers.findIndex(
					(m: MapMarkerResponse) => m.id === marker.id
				);
				if (index !== -1) {
					const updatedMarker = {
						...marker,
						createdAt: new SvelteDate(marker.createdAt),
						updatedAt: new SvelteDate(marker.updatedAt)
					} as MapMarkerResponse;

					this.markersById.set(marker.id, updatedMarker);
					this.campaign.mapMarkers[index] = updatedMarker;

					// Trigger reactivity by reassigning Map
					this.markersById = new SvelteMap(this.markersById);
					this.markersVersion++;
				}
			}
		}
	}

	protected handleMarkerDeleted(id: number) {
		if (this.campaign && 'mapMarkers' in this.campaign) {
			if (this.markersById.delete(id)) {
				this.campaign.mapMarkers = this.campaign.mapMarkers.filter(
					(m: MapMarkerResponse) => m.id !== id
				);

				// Trigger reactivity by reassigning Map
				this.markersById = new SvelteMap(this.markersById);
				this.markersVersion++;
			}
		}
	}

	protected handleTileHidden(tile: Pick<TileCoords, 'x' | 'y'>) {
		if (this.campaign && 'revealedTiles' in this.campaign) {
			const key = `${tile.x}-${tile.y}`;

			// Remove from both Sets (O(1))
			const wasRevealed = this.revealedTilesSet.delete(key);
			const wasAlwaysRevealed = this.alwaysRevealedTilesSet.delete(key);

			// Only filter array if tile was actually revealed
			if (wasRevealed || wasAlwaysRevealed) {
				this.campaign.revealedTiles = this.campaign.revealedTiles.filter(
					(t: TileCoords) => !(t.x === tile.x && t.y === tile.y)
				);
			}
		}
	}

	// Exploration event handlers (NEW)
	protected handleSessionStarted(session: GameSessionResponse) {
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

	protected handleSessionEnded(session: GameSessionResponse) {
		console.log('[localStateDM] SSE session:ended', session);

		// Update session in array
		const index = this.gameSessions.findIndex((s) => s.id === session.id);
		if (index !== -1) {
			this.gameSessions[index] = session;
		}
	}

	protected handleSessionDeleted(data: { id: number }) {
		console.log('[localStateDM] SSE session:deleted', data);

		// Remove session from array
		this.gameSessions = this.gameSessions.filter((s) => s.id !== data.id);

		// Remove associated path
		this.pathsMap.delete(data.id);
		this.pathsMap = new SvelteMap(this.pathsMap);
	}

	protected handleTimeUpdated(data: { globalGameTime: number }) {
		console.log('[localStateDM] SSE time:updated', data);
		this.globalGameTime = data.globalGameTime;
	}

	protected handleMovementStepAdded(data: { sessionId: number; step: PathStep; tiles: string[] }) {
		console.log('[localState] SSE movement:step-added', data);

		const path = this.pathsMap.get(data.sessionId);
		if (!path) {
			console.warn('[localState] Path not found for session', data.sessionId);
			return;
		}

		// Check if step already exists (from optimistic update)
		const stepExists = path.steps.some((s) => this.stepsEqual(s, data.step));
		if (stepExists) {
			console.log('[localState] Step already exists (optimistic)');
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

	// Helper methods
	protected stepsEqual(a: PathStep, b: PathStep): boolean {
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

	protected getStepDestination(step: PathStep): string | null {
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
