import { browser } from '$app/environment';
import type { CampaignDataResponse, PlayerCampaignDataResponse, TileCoords } from '$lib/types';
import EventEmitter from 'eventemitter3';

// Define a type for the event listener to ensure type safety
type EventListener<T> = (data: T) => void;

export class CampaignState extends EventEmitter {
	public campaign: CampaignDataResponse | PlayerCampaignDataResponse;
	private campaignSlug: string;
	private eventSource: EventSource | null = null;

	// Hover state management
	public hoveredTile = $state<TileCoords | null>(null);
	public showTileModal = $state(false);
	public modalTile = $state<TileCoords | null>(null);

	constructor(
		initialData: CampaignDataResponse | PlayerCampaignDataResponse,
		campaignSlug: string
	) {
		super();
		this.campaign = $state(initialData);
		this.campaignSlug = campaignSlug;
		if (browser) {
			this.connect();
		}
	}

	private connect() {
		if (this.eventSource) {
			return;
		}

		this.eventSource = new EventSource(`/api/campaigns/${this.campaignSlug}/events`);

		this.eventSource.onmessage = (event) => {
			// This handles the keep-alive messages
			console.log('SSE message:', event);
		};

		this.eventSource.onerror = (err) => {
			console.error('EventSource failed:', err);
			this.eventSource?.close();
			// Optional: implement reconnection logic here
		};

		// Register listeners for specific event types
		this.eventSource.addEventListener('tile-revealed', (event) => {
			try {
				const tiles = JSON.parse(event.data);
				// Handle both single tiles and arrays for backwards compatibility
				const tilesArray = Array.isArray(tiles) ? tiles : [tiles];
				tilesArray.forEach((tile) => this.emit('tile-revealed', tile));
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

	// Tile interaction state management
	setHoveredTile(tile: TileCoords | null) {
		this.hoveredTile = tile;
	}

	openTileModal(tile: TileCoords) {
		this.modalTile = tile;
		this.showTileModal = true;
	}

	closeTileModal() {
		this.showTileModal = false;
		this.modalTile = null;
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
