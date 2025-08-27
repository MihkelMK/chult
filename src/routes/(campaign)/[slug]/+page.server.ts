import { destroySession, createSession } from '$lib/server/session';
import { type Actions, redirect } from '@sveltejs/kit';

export const actions: Actions = {
	logout: async (event) => {
		destroySession(event);
		throw redirect(302, '/');
	},
	toggleView: async (event) => {
		const { locals, params } = event;
		if (!locals.session || locals.session.role !== 'dm') {
			throw redirect(302, '/');
		}

		const newViewAs = locals.session.viewAs === 'player' ? locals.session.role : 'player';
		await createSession(event, { ...locals.session, viewAs: newViewAs });

		throw redirect(302, `/${params.slug}`);
	}
};
