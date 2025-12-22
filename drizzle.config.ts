import { config } from 'dotenv';
import { expand } from 'dotenv-expand';
import { defineConfig } from 'drizzle-kit';

// Load environment variables from .env file (development)
// In production, PRIVATE_DATABASE_URL is constructed by entrypoint.sh from Docker secrets
expand(config());

if (!process.env.PRIVATE_DATABASE_URL) {
	throw new Error('PRIVATE_DATABASE_URL environment variable is not set.');
}

export default defineConfig({
	schema: './src/lib/server/db/schema.ts',
	out: './drizzle',
	dialect: 'postgresql',
	dbCredentials: { url: process.env.PRIVATE_DATABASE_URL },
	verbose: true,
	strict: true
});
