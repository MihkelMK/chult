import { browser } from '$app/environment';
import type { CampaignDataResponse, PlayerCampaignDataResponse, TileCoords } from '$lib/types';
import EventEmitter from 'eventemitter3';
import { SvelteSet } from 'svelte/reactivity';

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
}
