import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import eventEmitter from '$lib/server/events';
import { requireAuth } from '$lib/server/session';

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
			const listener = (event: { event: string; data: unknown; role: 'dm' | 'player' | 'all' }) => {
				// Role-based filtering
				if (event.role === 'all' || event.role === session.role) {
					const sseMessage = `event: ${event.event}\ndata: ${JSON.stringify(event.data)}\n\n`;
					controller.enqueue(sseMessage);
				}
			};

			eventEmitter.on(`campaign-${params.slug}`, listener);

			// Keep the connection alive by sending a comment every 20 seconds
			const keepAliveInterval = setInterval(() => {
				controller.enqueue(': keep-alive\n\n');
			}, 20000);

			// Clean up when the connection is closed
			// SvelteKit does not have a built-in way to detect client disconnects
			// in ReadableStream, so we rely on the client to close the connection.
			// A more robust solution might involve a heartbeat mechanism where
			// the server closes the stream if it doesn't receive a ping.
			// For now, this is sufficient.
			const cleanup = () => {
				eventEmitter.off(`campaign-${params.slug}`, listener);
				clearInterval(keepAliveInterval);
			};

			// HACK: SvelteKit doesn't expose a way to know when the stream is cancelled.
			// This is a workaround to detect when the client disconnects.
			const timer = setInterval(() => {
				try {
					controller.enqueue(': ping\n\n');
				} catch {
					cleanup();
					clearInterval(timer);
				}
			}, 1000);
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
