import { env } from '$env/dynamic/private';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

// Use dynamic env to read PRIVATE_DATABASE_URL at runtime (not build time)
const PRIVATE_DATABASE_URL = env.PRIVATE_DATABASE_URL;

if (!PRIVATE_DATABASE_URL) throw new Error('PRIVATE_DATABASE_URL is not set');

const client = postgres(PRIVATE_DATABASE_URL, {
	max: 5, // Connection pool size (small for <10 users)
	idle_timeout: 20, // Close idle connections after 20s
	connect_timeout: 10, // Fail fast on connection errors
	prepare: false // Required for pgbouncer transaction pooling
});

export const db = drizzle(client, { schema });
