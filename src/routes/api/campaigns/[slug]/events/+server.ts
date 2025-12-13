import eventEmitter from '$lib/server/events';
import { requireAuth } from '$lib/server/session';
import type { EventRole } from '$lib/types/events';
import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async (event) => {
	const { params } = event;
	const session = requireAuth(event);

	if (!session) {
		error(401, 'Unauthorized');
	}

	if (session.campaignSlug !== params.slug) {
		error(403, 'Forbidden');
	}

	const stream = new ReadableStream({
		start(controller) {
			const listener = (event: { event: string; data: unknown; role: EventRole }) => {
				// Role-based filtering
				if (event.role === 'all' || event.role === session.role) {
					try {
						const sseMessage = `event: ${event.event}\ndata: ${JSON.stringify(event.data)}\n\n`;
						controller.enqueue(sseMessage);
					} catch {
						// Stream closed, trigger cleanup
						cleanup();
					}
				}
			};

			eventEmitter.on(`campaign-${params.slug}`, listener);

			// Keep the connection alive by sending a comment every 20 seconds
			const keepAliveInterval = setInterval(() => {
				try {
					controller.enqueue(': keep-alive\n\n');
				} catch {
					cleanup();
				}
			}, 20000);

			// Ping every second to detect client disconnects
			const pingInterval = setInterval(() => {
				try {
					controller.enqueue(': ping\n\n');
				} catch {
					cleanup();
				}
			}, 1000);

			// Centralized cleanup - can be called multiple times safely
			let cleanedUp = false;
			function cleanup() {
				if (cleanedUp) return;
				cleanedUp = true;

				eventEmitter.off(`campaign-${params.slug}`, listener);
				clearInterval(keepAliveInterval);
				clearInterval(pingInterval);
				console.log(`[SSE] Connection closed for campaign: ${params.slug}, role: ${session?.role}`);
			}
		}
	});

	return new Response(stream, {
		headers: {
			'Content-Type': 'text/event-stream',
			'Cache-Control': 'no-cache',
			Connection: 'keep-alive'
		}
	});
};
