import { EventEmitter } from 'events';

// This is a singleton instance that will be shared across the entire server.
// It allows different parts of the application (e.g., API endpoints) to emit events,
// and other parts (e.g., the SSE endpoint) to listen for them, decoupling the logic.
const eventEmitter = new EventEmitter();

export default eventEmitter;
