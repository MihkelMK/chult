import eventEmitter, {
  channelFor,
  frameId,
  parseLastEventId,
  releaseBuffer,
  replayAfter,
  type BusEvent,
} from '$lib/server/events';
import { requireAuth } from '$lib/server/session';
import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

// How long the browser should wait before reconnecting. Without an explicit retry field
// the spec default (~3s) applies with no backoff, so an outage has every client retrying
// in lockstep indefinitely.
const RECONNECT_DELAY = 5000;

// Comment frames keep idle proxies from closing the connection.
const KEEP_ALIVE_INTERVAL = 20000;

const frame = (entry: BusEvent) => `id: ${frameId(entry)}\nevent: ${entry.event}\ndata: ${JSON.stringify(entry.data)}\n\n`;

export const GET: RequestHandler = async (event) => {
  const { params } = event;
  const session = requireAuth(event);

  if (!session) {
    error(401, 'Unauthorized');
  }

  if (session.campaignSlug !== params.slug) {
    error(403, 'Forbidden');
  }

  const slug = params.slug;
  const channel = channelFor(slug);
  const visible = (entry: BusEvent) => entry.role === 'all' || entry.role === session.role;

  // Set by the browser when it reconnects a dropped stream. 'stale' means a previous
  // process issued it, so its sequence number means nothing here.
  const lastEventId = parseLastEventId(event.request.headers.get('last-event-id'));

  let listener: ((entry: BusEvent) => void) | null = null;
  let keepAliveInterval: ReturnType<typeof setInterval> | null = null;

  // Safe to call more than once.
  const cleanup = () => {
    if (listener) {
      eventEmitter.off(channel, listener);
      listener = null;
      releaseBuffer(slug);
    }
    if (keepAliveInterval) {
      clearInterval(keepAliveInterval);
      keepAliveInterval = null;
    }
  };

  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(`retry: ${RECONNECT_DELAY}\n\n`);

      // Bring a reconnecting client back up to date before it starts receiving live
      // events, so no delta is lost in the gap.
      if (lastEventId !== null) {
        const missed = lastEventId === 'stale' ? 'gap' : replayAfter(slug, lastEventId);

        if (missed === 'gap') {
          // Too far behind to patch up. The client refetches its state instead.
          controller.enqueue(`event: resync\ndata: {}\n\n`);
        } else {
          for (const entry of missed) {
            if (visible(entry)) {
              controller.enqueue(frame(entry));
            }
          }
        }
      }

      listener = (entry: BusEvent) => {
        // Role-based filtering
        if (!visible(entry)) {
          return;
        }

        try {
          controller.enqueue(frame(entry));
        } catch {
          // Stream closed, trigger cleanup
          cleanup();
        }
      };

      eventEmitter.on(channel, listener);

      keepAliveInterval = setInterval(() => {
        try {
          controller.enqueue(': keep-alive\n\n');
        } catch {
          cleanup();
        }
      }, KEEP_ALIVE_INTERVAL);
    },

    // Called when the client disconnects.
    cancel() {
      cleanup();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
};
