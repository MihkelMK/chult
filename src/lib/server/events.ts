import type { CampaignEvent, EventRole } from '$lib/types/events';
import { randomUUID } from 'crypto';
import { EventEmitter } from 'events';

// This is a singleton instance that will be shared across the entire server.
// It allows different parts of the application (e.g., API endpoints) to emit events,
// and other parts (e.g., the SSE endpoint) to listen for them, decoupling the logic.
const eventEmitter = new EventEmitter();

export default eventEmitter;

export interface BusEvent {
  id: number;
  event: CampaignEvent;
  data: unknown;
  role: EventRole;
}

// Recent events per campaign, so a reconnecting client can be told what it missed.
// The bus carries deltas rather than snapshots, so reconnecting without a replay leaves
// the client silently out of sync instead of merely late.
const buffers = new Map<string, BusEvent[]>();

// Events retained per campaign. A client that falls further behind than this is asked to
// resynchronise from the API rather than being given a partial replay.
const MAX_BUFFERED_EVENTS = 500;

// Single monotonic sequence shared by all campaigns. Ids only need to be comparable and
// increasing; a client seeing gaps because events belonged to another campaign, or were
// filtered out by role, is expected.
let sequence = 0;

// Identifies this process. The sequence restarts at zero every boot, so an id alone cannot
// say which run issued it: a client reconnecting with id 5 from a previous run would be
// handed this run's events 6 onward and told it is up to date. Echoed back in
// Last-Event-ID, where a mismatch means the client's state predates this process.
const BOOT_ID = randomUUID().slice(0, 8);

// Buffer, sequence and emitter live in this process's memory, so every client of a campaign
// must reach the same instance. compose.yml pins container_name, which Docker will not
// accept alongside replicas, so that holds today. Scaling out needs a shared bus.

export function channelFor(campaignSlug: string) {
  return `campaign-${campaignSlug}`;
}

// Helper function to emit events for a specific campaign
export function emitEvent(campaignSlug: string, eventType: CampaignEvent, data: unknown, role: EventRole = 'all') {
  const entry: BusEvent = { id: ++sequence, event: eventType, data, role };

  const buffer = buffers.get(campaignSlug) ?? [];
  buffer.push(entry);
  if (buffer.length > MAX_BUFFERED_EVENTS) {
    buffer.splice(0, buffer.length - MAX_BUFFERED_EVENTS);
  }
  buffers.set(campaignSlug, buffer);

  eventEmitter.emit(channelFor(campaignSlug), entry);
}

/**
 * Events a reconnecting client missed, or 'gap' when it cannot be brought up to date from
 * the buffer alone and has to reload its state from the API instead.
 */
export function replayAfter(campaignSlug: string, lastEventId: number): BusEvent[] | 'gap' {
  // Unreachable: BOOT_ID rejects cross-process ids before this is called. Kept as a cheap
  // backstop, since an id this run never issued cannot be replayed against its buffer.
  if (lastEventId > sequence) {
    return 'gap';
  }

  const buffer = buffers.get(campaignSlug);

  // No retained history says nothing about what the client missed: `releaseBuffer` drops a
  // campaign's buffer as soon as its last listener goes, which happens while another client
  // is still holding a dead socket it is about to reconnect. Treating that as "caught up"
  // leaves it silently stale, so ask it to resynchronise. The cost when the campaign really
  // was idle is one extra /data fetch.
  if (!buffer || buffer.length === 0) {
    return 'gap';
  }

  // The oldest event we still hold is newer than the next one the client expects, so
  // whatever fell out of the buffer in between is unrecoverable.
  if (buffer[0].id > lastEventId + 1) {
    return 'gap';
  }

  return buffer.filter((entry) => entry.id > lastEventId);
}

/**
 * Drop a campaign's buffer once nothing is listening, so it does not grow without bound.
 * Call after removing a listener.
 */
export function releaseBuffer(campaignSlug: string) {
  if (eventEmitter.listenerCount(channelFor(campaignSlug)) === 0) {
    buffers.delete(campaignSlug);
  }
}

/** The `id:` field for an SSE frame: this process, then the sequence number. */
export function frameId(entry: BusEvent) {
  return `${BOOT_ID}:${entry.id}`;
}

/**
 * Last-Event-ID as a sequence number, 'stale' when another process issued it, null when
 * absent (a first connection rather than a reconnection).
 */
export function parseLastEventId(raw: string | null): number | 'stale' | null {
  if (!raw) return null;

  const separator = raw.lastIndexOf(':');
  if (separator === -1) return 'stale';
  if (raw.slice(0, separator) !== BOOT_ID) return 'stale';

  const id = Number(raw.slice(separator + 1));
  return Number.isFinite(id) && id > 0 ? id : null;
}
