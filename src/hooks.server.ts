import { getSession } from '$lib/server/session';
import type { Handle } from '@sveltejs/kit';

export const handle: Handle = async ({ event, resolve }) => {
	event.locals.session = await getSession(event);
	return resolve(event);
};
