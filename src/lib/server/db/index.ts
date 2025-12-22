import { PRIVATE_DATABASE_URL } from '$env/static/private';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

if (!PRIVATE_DATABASE_URL) throw new Error('PRIVATE_DATABASE_URL is not set');

const client = postgres(PRIVATE_DATABASE_URL, {
	max: 5, // Connection pool size (small for <10 users)
	idle_timeout: 20, // Close idle connections after 20s
	connect_timeout: 10, // Fail fast on connection errors
	prepare: false // Required for pgbouncer transaction pooling
});

export const db = drizzle(client, { schema });
