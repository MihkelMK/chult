import type { Handle } from '@sveltejs/kit/hooks';
import { getSession } from '#lib/server/session.ts';

export const handle: Handle = async ({ event, resolve }) => {
  event.locals.session = getSession(event);
  return resolve(event);
};
