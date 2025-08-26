import { destroySession } from '$lib/server/session';
import { redirect } from '@sveltejs/kit';
import type { Actions } from './$types';

export const actions: Actions = {
	logout: async (event) => {
		destroySession(event);
		throw redirect(302, '/');
	}
};
