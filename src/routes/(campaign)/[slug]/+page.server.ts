import { destroySession } from '$lib/server/session';
import { type Actions, redirect } from '@sveltejs/kit';

export const actions: Actions = {
	logout: async (event) => {
		destroySession(event);
		throw redirect(302, '/');
	}
};
