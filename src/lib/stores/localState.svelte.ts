import { browser } from '$app/environment';
import type {
	CampaignDataResponse,
	MapMarkerResponse,
	PathResponse,
	PlayerCampaignDataResponse,
	RevealedTile,
	SessionResponse,
	TileCoords
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

	// Protected markers map for O(1) lookups (shared between DM and Player)
	protected markersMap = new SvelteMap<number, MapMarkerResponse>();

	// Exploration state (NEW)
	public globalGameTime = $state(0); // Days as float
	public partyTokenPosition = $state<TileCoords | null>(null);
	public sessions = $state<SessionResponse[]>([]);
	protected pathsMap = new SvelteMap<number, PathResponse>(); // sessionId -> PathResponse

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
		return this.sessions.find((s) => s.isActive) ?? null;
	});

	public currentPath = $derived.by(() => {
		if (!this.activeSession) return null;
		return this.pathsMap.get(this.activeSession.id) ?? null;
	});

	// Version counter to force reactivity when Sets change
	public tilesVersion = $state(0);

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
		this.sessions = initialData.sessions || [];
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
		this.eventSource.addEventListener('tile-revealed', (event) => {
			try {
				const tiles = JSON.parse(event.data);
				// Handle both single tiles and arrays for backwards compatibility
				const tilesArray = Array.isArray(tiles) ? tiles : [tiles];
				// Emit the entire array at once for batch processing
				this.emit('tiles-revealed-batch', tilesArray);
			} catch (error) {
				console.error('Failed to parse tile-revealed event:', error);
			}
		});

		this.eventSource.addEventListener('marker-created', (event) => {
			try {
				const marker = JSON.parse(event.data);
				this.emit('marker-created', marker);
			} catch (error) {
				console.error('Failed to parse marker-created event:', error);
			}
		});

		this.eventSource.addEventListener('marker-updated', (event) => {
			try {
				const marker = JSON.parse(event.data);
				this.emit('marker-updated', marker);
			} catch (error) {
				console.error('Failed to parse marker-updated event:', error);
			}
		});

		this.eventSource.addEventListener('marker-deleted', (event) => {
			try {
				const data = JSON.parse(event.data);
				this.emit('marker-deleted', data);
			} catch (error) {
				console.error('Failed to parse marker-deleted event:', error);
			}
		});

		this.eventSource.addEventListener('tile-hidden', (event) => {
			try {
				const tiles = JSON.parse(event.data);
				// Handle both single tiles and arrays for consistency
				const tilesArray = Array.isArray(tiles) ? tiles : [tiles];
				tilesArray.forEach((tile) => this.emit('tile-hidden', tile));
			} catch (error) {
				console.error('Failed to parse tile-hidden event:', error);
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
	getTileMarkers(coords: TileCoords, role: 'dm' | 'player') {
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
		this.markersMap = new SvelteMap(markers.map((m) => [m.id, m]));
	}

	protected initializePathsMap(paths: PathResponse[]) {
		this.pathsMap = new SvelteMap(paths.map((p) => [p.sessionId, p]));
	}

	// Protected shared event handlers
	protected handleMarkerCreated(marker: MapMarkerResponse) {
		if (this.campaign && 'mapMarkers' in this.campaign) {
			// Check Map first for O(1) duplicate detection
			if (!this.markersMap.has(marker.id)) {
				const newMarker = {
					...marker,
					createdAt: new SvelteDate(marker.createdAt),
					updatedAt: new SvelteDate(marker.updatedAt)
				} as MapMarkerResponse;
				this.markersMap.set(marker.id, newMarker);
				this.campaign.mapMarkers.push(newMarker);
			}
		}
	}

	protected handleMarkerUpdated(marker: MapMarkerResponse) {
		if (this.campaign && 'mapMarkers' in this.campaign) {
			// O(1) lookup in Map
			if (this.markersMap.has(marker.id)) {
				const index = this.campaign.mapMarkers.findIndex(
					(m: MapMarkerResponse) => m.id === marker.id
				);
				if (index !== -1) {
					const updatedMarker = {
						...marker,
						createdAt: new SvelteDate(marker.createdAt),
						updatedAt: new SvelteDate(marker.updatedAt)
					} as MapMarkerResponse;
					this.markersMap.set(marker.id, updatedMarker);
					this.campaign.mapMarkers[index] = updatedMarker;
				}
			}
		}
	}

	protected handleMarkerDeleted(id: number) {
		if (this.campaign && 'mapMarkers' in this.campaign) {
			// O(1) check and delete from Map
			if (this.markersMap.delete(id)) {
				// Only filter array if marker existed
				this.campaign.mapMarkers = this.campaign.mapMarkers.filter(
					(m: MapMarkerResponse) => m.id !== id
				);
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
}
