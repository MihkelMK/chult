import { destroySession, createSession } from '$lib/server/session';
import { redirect } from '@sveltejs/kit';
import type { Actions } from './$types';

export const actions: Actions = {
	logout: async (event) => {
		destroySession(event);
		throw redirect(302, '/');
	},
	toggleView: async (event) => {
		const { locals } = event;
		if (!locals.session || locals.session.role !== 'dm') {
			throw redirect(302, '/');
		}

		const newViewAs = locals.session.viewAs === 'player' ? undefined : 'player';

		await createSession(event, { ...locals.session, viewAs: newViewAs });

		throw redirect(302, newViewAs === 'player' ? `/` : `/dm/${locals.session.campaignSlug}`);
	}
};
