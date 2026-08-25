import { browser } from '$app/environment';
import type {
  CampaignDataResponse,
  GameSessionResponse,
  MapMarkerResponse,
  PathResponse,
  PathStep,
  PlayerCampaignDataResponse,
  RevealedTile,
  RevealedTileResponse,
  TileCoords,
  TimeAuditLogResponse,
} from '$lib/types';
import { CAMPAIGN_EVENTS, type CampaignEvent } from '$lib/types/events';
import EventEmitter from 'eventemitter3';
import { SvelteDate, SvelteMap, SvelteSet } from 'svelte/reactivity';

// Define a type for the event listener to ensure type safety
type EventListener<T> = (data: T) => void;

/**
 * `/api/campaigns/[slug]/data` serialises with JSON, so timestamps arrive as strings.
 * The initial page load goes through SvelteKit's devalue serialisation and yields real
 * Date objects, so revive them here to keep both paths interchangeable.
 */
function reviveDates<T extends CampaignDataResponse | PlayerCampaignDataResponse>(data: T): T {
  const revive = <O, K extends keyof O>(record: O, keys: K[]) => {
    for (const key of keys) {
      const value = record[key];
      if (typeof value === 'string') {
        record[key] = new SvelteDate(value) as O[K];
      }
    }
    return record;
  };

  data.mapMarkers?.forEach((marker) => revive(marker, ['createdAt', 'updatedAt']));
  data.gameSessions?.forEach((session) => revive(session, ['startedAt', 'endedAt', 'lastActivityAt', 'createdAt']));
  // Player payloads omit revealedAt, so treat it as optional rather than required.
  data.revealedTiles?.forEach((tile) => revive(tile as { revealedAt?: Date | string }, ['revealedAt']));
  (data as CampaignDataResponse).timeAuditLog?.forEach((entry) => revive(entry, ['timestamp']));

  return data;
}

export class LocalState extends EventEmitter {
  public campaign: CampaignDataResponse | PlayerCampaignDataResponse;
  private campaignSlug: string;
  private eventSource: EventSource | null = null;

  // Hover state management
  public hoveredTile = $state<TileCoords | null>(null);

  // Live-connection status for the event stream
  public connected = $state(false);

  // Empty sets for typescript (overridden in subclasses)
  public revealedTilesSet = new SvelteSet<string>();
  public alwaysRevealedTilesSet = new SvelteSet<string>();

  // Markers maps for O(1) lookups (shared between DM and Player)
  public markersById = $state(new SvelteMap<number, MapMarkerResponse>()); // Key: marker.id (for SSE handlers)

  // Derived map for O(1) tile-based lookups (automatically synced from markersById)
  // Supports dual markers per tile: one DM (hidden) and one player (visible)
  public markersByTile = $derived.by(() => {
    const byTile = new SvelteMap<string, { dm?: MapMarkerResponse; player?: MapMarkerResponse }>();
    this.markersById.forEach((marker) => {
      const key = `${marker.x}-${marker.y}`;
      const existing = byTile.get(key) || {};
      if (marker.visibleToPlayers) {
        existing.player = marker;
      } else {
        existing.dm = marker;
      }
      byTile.set(key, existing);
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

  // Live events that arrived while a resync snapshot was being fetched, held so the older
  // snapshot cannot overwrite them. Not reactive: nothing renders from the backlog itself.
  private resyncPending = false;
  private queuedDuringResync: { name: CampaignEvent; payload: unknown }[] = [];

  constructor(initialData: CampaignDataResponse | PlayerCampaignDataResponse, campaignSlug: string) {
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
        y: initialData.campaign.partyTokenY,
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

    this.eventSource.onopen = () => {
      this.connected = true;
    };

    this.eventSource.onerror = () => {
      this.connected = false;

      // BROKEN ON FIREFOX, see #135. The intent below is that CLOSED means the server
      // refused (non-2xx, or the wrong content type) while anything else is a transient
      // drop the browser is already retrying. That holds on Chromium. Firefox also sets
      // CLOSED when the network disappears under an established stream, so a WiFi blip
      // takes this branch, nulls the handle, and `connect()` returns early forever after.
      // `readyState` cannot separate the two cases. #135 replaces this client with the
      // fetch-based `eventsource` package, which retries in JS and exposes the status.
      // Nothing reads `connected` yet either, so an expiring session leaves a silently
      // frozen map; #138 surfaces it.
      if (this.eventSource?.readyState === EventSource.CLOSED) {
        console.error('[localState] EventSource closed; not retrying (broken on Firefox, see #135)');
        this.eventSource = null;
      }
    };

    // Forward every bus event onto the internal emitter. Driving this from the shared
    // event-name list means a newly added server event cannot be left without a listener.
    for (const name of CAMPAIGN_EVENTS) {
      this.eventSource.addEventListener(name, (event) => {
        let payload: unknown;

        try {
          payload = JSON.parse(event.data);
        } catch (error) {
          console.error(`Failed to parse ${name} event:`, error);
          return;
        }

        // A resync snapshot is read on the server before the fetch resolves, so an event
        // applied while one is in flight would be overwritten by older data and never
        // corrected. Hold it back and replay it once the snapshot has landed.
        if (this.resyncPending) {
          this.queuedDuringResync.push({ name, payload });
          return;
        }

        this.dispatch(name, payload);
      });
    }

    this.eventSource.addEventListener('resync', () => {
      void this.resync();
    });
  }

  // Translate a bus event into the internal event(s) the stores listen for.
  private dispatch(name: CampaignEvent, payload: unknown) {
    switch (name) {
      case 'tile:revealed': {
        // Handle both single tiles and arrays for backwards compatibility.
        // Emit the whole array at once for batch processing.
        this.emit('tiles:revealed:batch', Array.isArray(payload) ? payload : [payload]);
        return;
      }

      case 'tile:hidden': {
        const tiles = Array.isArray(payload) ? payload : [payload];
        tiles.forEach((tile) => this.emit('tile:hidden', tile));
        return;
      }

      default:
        this.emit(name, payload);
    }
  }

  // Rebuild all state from a fresh server snapshot.
  private async resync() {
    if (this.resyncPending) {
      return;
    }

    this.resyncPending = true;

    try {
      const response = await fetch(`/api/campaigns/${this.campaignSlug}/data`);

      if (!response.ok) {
        throw new Error(`Resync request failed: ${response.status}`);
      }

      this.applySnapshot(reviveDates(await response.json()));
      this.emit('state:resynced');
    } catch (error) {
      // Nothing was replaced, so the queued events still apply to the state we already
      // hold. Draining them below keeps the client no worse off than before the attempt.
      console.error('[localState] Resync failed:', error);
    } finally {
      // Drain before clearing the flag so an event arriving mid-drain queues behind the
      // backlog rather than overtaking it.
      while (this.queuedDuringResync.length > 0) {
        const queued = this.queuedDuringResync.shift()!;
        this.dispatch(queued.name, queued.payload);
      }

      this.resyncPending = false;
    }
  }

  /**
   * Replace every piece of derived state with a fresh snapshot. Sets are cleared in place
   * rather than reassigned because subclasses do not all declare them as `$state`, so a
   * reassignment would leave components holding the previous instance.
   */
  protected applySnapshot(data: CampaignDataResponse | PlayerCampaignDataResponse) {
    this.campaign = data;

    this.globalGameTime = data.campaign.globalGameTime;
    this.partyTokenPosition =
      data.campaign.partyTokenX !== null && data.campaign.partyTokenY !== null
        ? { x: data.campaign.partyTokenX, y: data.campaign.partyTokenY }
        : null;

    this.gameSessions = data.gameSessions || [];
    this.initializePathsMap(data.paths || []);
    this.initializeMarkersMap(data.mapMarkers);

    this.revealedTilesSet.clear();
    this.alwaysRevealedTilesSet.clear();
    this.initializeRevealedTileSets(data.revealedTiles);

    this.tilesVersion++;
    this.markersVersion++;
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
  async makeApiRequest<T>(endpoint: string, method: 'POST' | 'PUT' | 'DELETE', body?: object): Promise<T> {
    const response = await fetch(`/api/campaigns/${this.campaignSlug}/${endpoint}`, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
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

  // Protected shared initialization methods
  protected initializeRevealedTileSets(tiles: (RevealedTile | Pick<RevealedTile, 'x' | 'y' | 'alwaysRevealed'>)[]) {
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
          updatedAt: new SvelteDate(marker.updatedAt),
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
        const index = this.campaign.mapMarkers.findIndex((m: MapMarkerResponse) => m.id === marker.id);
        if (index !== -1) {
          const updatedMarker = {
            ...marker,
            createdAt: new SvelteDate(marker.createdAt),
            updatedAt: new SvelteDate(marker.updatedAt),
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
        this.campaign.mapMarkers = this.campaign.mapMarkers.filter((m: MapMarkerResponse) => m.id !== id);

        // Trigger reactivity by reassigning Map
        this.markersById = new SvelteMap(this.markersById);
        this.markersVersion++;
      }
    }
  }

  protected handleAlwaysRevealedUpdated(data: {
    updated: { x: number; y: number; alwaysRevealed: boolean }[];
    created: { x: number; y: number }[];
  }) {
    const apply = (tile: { x: number; y: number }, alwaysRevealed: boolean) => {
      const key = `${tile.x}-${tile.y}`;

      if (alwaysRevealed) {
        this.revealedTilesSet.delete(key);
        this.alwaysRevealedTilesSet.add(key);
      } else {
        this.alwaysRevealedTilesSet.delete(key);
        this.revealedTilesSet.add(key);
      }

      if (this.campaign && 'revealedTiles' in this.campaign) {
        const entry = this.campaign.revealedTiles.find((t: TileCoords) => t.x === tile.x && t.y === tile.y);
        if (entry) {
          (entry as { alwaysRevealed: boolean }).alwaysRevealed = alwaysRevealed;
        } else {
          // A tile the server has only just inserted has no entry yet. Without this the
          // array drifts out of sync with the Sets and a later hide cannot remove it.
          // Player payloads omit `revealedAt`, carrying it here is harmless for them.
          (this.campaign.revealedTiles as RevealedTileResponse[]).push({
            x: tile.x,
            y: tile.y,
            alwaysRevealed,
            revealedAt: new SvelteDate(),
          });
        }
      }
    };

    data.updated?.forEach((tile) => apply(tile, tile.alwaysRevealed));
    // Tiles that did not exist yet are only created when toggling *on*.
    data.created?.forEach((tile) => apply(tile, true));

    this.tilesVersion++;
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
      revealedTiles: [],
    };
    this.pathsMap.set(session.id, newPath);
  }

  protected handleSessionEnded(session: GameSessionResponse) {
    // Update session in array
    const index = this.gameSessions.findIndex((s) => s.id === session.id);
    if (index !== -1) {
      this.gameSessions[index] = session;
    }
  }

  protected handleSessionDeleted(data: { id: number }) {
    // Remove session from array
    this.gameSessions = this.gameSessions.filter((s) => s.id !== data.id);

    // Remove associated path
    this.pathsMap.delete(data.id);
    this.pathsMap = new SvelteMap(this.pathsMap);
  }

  protected handleTimeUpdated(data: { globalGameTime: number }) {
    this.globalGameTime = data.globalGameTime;
  }

  protected handleMovementStepAdded(data: { sessionId: number; step: PathStep; tiles: string[] }) {
    const path = this.pathsMap.get(data.sessionId);
    if (!path) {
      console.warn('[localState] Path not found for session', data.sessionId);
      return;
    }

    // Check if step already exists (from optimistic update)
    const stepExists = path.steps.some((s) => this.stepsEqual(s, data.step));
    if (stepExists) {
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
        return b.type === 'player_move' && a.tileKey === b.tileKey && Math.abs(a.gameTime - b.gameTime) < 0.001;
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
