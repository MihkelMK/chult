import { EventEmitter } from 'events';

// This is a singleton instance that will be shared across the entire server.
// It allows different parts of the application (e.g., API endpoints) to emit events,
// and other parts (e.g., the SSE endpoint) to listen for them, decoupling the logic.
const eventEmitter = new EventEmitter();

export default eventEmitter;

// Helper function to emit events for a specific campaign
export function emitEvent(
	campaignSlug: string,
	eventType: string,
	data: unknown,
	role: 'dm' | 'player' | 'all' = 'all'
) {
	eventEmitter.emit(`campaign-${campaignSlug}`, {
		event: eventType,
		data,
		role
	});
}
