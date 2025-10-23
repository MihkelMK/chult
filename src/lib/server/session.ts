import { dev } from '$app/environment';
import { campaigns } from '$lib/server/db/schema';
import type { RequestEvent } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { db } from './db';

export interface SessionData {
	campaignId: number;
	campaignSlug: string;
	role: 'dm' | 'player';
	viewAs?: 'dm' | 'player';
	expiresAt: number;
}

// In-memory session store (use Redis in production)
const sessions = new Map<string, SessionData>();

function generateSessionId(): string {
	return crypto.randomUUID();
}

function isSessionExpired(session: SessionData): boolean {
	return Date.now() > session.expiresAt;
}

export async function validateCampaignAccess(
	campaignSlug: string,
	token: string,
	requiredRole?: 'dm' | 'player'
) {
	const campaign = await db
		.select()
		.from(campaigns)
		.where(eq(campaigns.slug, campaignSlug))
		.limit(1);

	if (!campaign[0]) {
		return null;
	}

	const camp = campaign[0];
	let role: 'dm' | 'player' | null = null;

	if (token === camp.dmToken) {
		role = 'dm';
	} else if (token === camp.playerToken) {
		role = 'player';
	}

	if (!role || (requiredRole && role !== requiredRole)) {
		return null;
	}

	return {
		campaign: camp,
		role
	};
}

export async function createSession(
	event: RequestEvent,
	sessionData: Omit<SessionData, 'expiresAt'> | SessionData
) {
	const sessionId = event.cookies.get('session') || generateSessionId();
	const expiresAt = Date.now() + 24 * 60 * 60 * 1000; // 24 hours

	const session: SessionData = {
		...sessionData,
		expiresAt
	};

	// Store in Redis/database in production instead of Map
	// if (import.meta.env.PROD) {
	// 	await redis.setex(`session:${sessionId}`, 86400, JSON.stringify(session));
	// } else {
	// 	sessions.set(sessionId, session);
	// }
	sessions.set(sessionId, session);

	// Set HTTP-only cookie
	event.cookies.set('session', sessionId, {
		path: '/',
		httpOnly: true,
		secure: !dev,
		sameSite: 'lax',
		maxAge: 24 * 60 * 60 // 24 hours
	});

	return sessionId;
}

export function getSession(event: RequestEvent): SessionData | null {
	const sessionId = event.cookies.get('session');

	if (!sessionId) {
		return null;
	}

	const session = sessions.get(sessionId);

	if (!session || isSessionExpired(session)) {
		if (session) {
			sessions.delete(sessionId);
			event.cookies.delete('session', { path: '/' });
		}
		return null;
	}

	return session;
}

export function destroySession(event: RequestEvent): void {
	const sessionId = event.cookies.get('session');

	if (sessionId) {
		sessions.delete(sessionId);
	}

	event.cookies.delete('session', { path: '/' });
}

export function requireAuth(event: RequestEvent, requiredRole?: 'dm' | 'player') {
	const session = getSession(event);

	if (!session) {
		return null;
	}

	const effectiveRole = session.viewAs || session.role;

	if (requiredRole && requiredRole === 'dm' && effectiveRole !== 'dm') {
		return null;
	}

	return session;
}
