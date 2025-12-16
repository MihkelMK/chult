import { defineConfig } from 'drizzle-kit';
import fs from 'fs';

let dbCredentials:
	| ({
			host: string;
			port?: number;
			user?: string;
			password?: string;
			database: string;
	  } & {})
	| {
			url: string;
	  };

// Read DB secrets from files
// File path is defined by env var
const readDBSecretFile = (path: string | undefined) => {
	if (!path) {
		throw new Error(`${path} not set for production.`);
	}
	try {
		const secret = fs.readFileSync(path, 'utf-8').trim();
		return secret;
	} catch (err) {
		throw new Error(`Failed to read database URL from file: ${path}\n${err}`);
	}
};

// For production, read values from files specified by POSTGRES_*_FILE
if (process.env.NODE_ENV === 'production') {
	// Passed as variable
	if (!process.env.POSTGRES_HOST) {
		throw new Error('POSTGRES_HOST environment variable is not set for production.');
	}
	// Passed as files
	dbCredentials = {
		host: process.env.POSTGRES_HOST,
		user: readDBSecretFile(process.env.POSTGRES_USER_FILE),
		password: readDBSecretFile(process.env.POSTGRES_PASSWORD_FILE),
		database: readDBSecretFile(process.env.POSTGRES_DB_FILE)
	};
} else {
	// For development and other environments, use the DATABASE_URL environment variable
	if (!process.env.PRIVATE_DATABASE_URL) {
		throw new Error('PRIVATE_DATABASE_URL environment variable is not set for development.');
	}
	dbCredentials = { url: process.env.PRIVATE_DATABASE_URL };
}

export default defineConfig({
	schema: './src/lib/server/db/schema.ts',
	out: './drizzle',
	dialect: 'postgresql',
	dbCredentials: dbCredentials,
	verbose: true,
	strict: true
});
