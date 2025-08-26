// See https://svelte.dev/docs/kit/types#app.d.ts

import type { SessionData } from '$lib/server/session';

// for information about these interfaces
declare global {
	namespace App {
		interface Locals {
			session: SessionData;
		}
	} // interface Error {}
	// interface Locals {}
} // interface PageData {}
// interface PageState {}

// interface Platform {}
export {};
