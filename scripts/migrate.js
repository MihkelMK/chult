// Standalone migration runner used by entrypoint.sh in the production image.
//
// This exists instead of `drizzle-kit migrate` so drizzle-kit can stay a dev
// dependency. drizzle-kit bundles esbuild, which shipped Go stdlib CVEs into the
// runtime image even though the binary was never executed there. drizzle-orm's
// migrator reads the generated SQL in ./drizzle directly and needs neither
// drizzle.config.ts nor the schema source.
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { join } from 'node:path';
import postgres from 'postgres';

// Resolved from this file, not the CWD: a wrong CWD would otherwise make the
// migrator find no journal and report success without applying anything.
const migrationsFolder = join(import.meta.dirname, '..', 'drizzle');

const databaseUrl = process.env.PRIVATE_DATABASE_URL;

if (!databaseUrl) throw new Error('PRIVATE_DATABASE_URL is not set');

// max: 1 so migrations run sequentially on one connection.
// prepare: false to match src/lib/server/db/index.ts.
// pgbouncer transaction pooling does not support prepared statements.
const client = postgres(databaseUrl, { max: 1, prepare: false });

try {
  await migrate(drizzle(client), { migrationsFolder });
  console.log('Migrations applied.');
} finally {
  // Swallowed: a failing close must not replace the migration error that caused it.
  await client.end().catch(() => {});
}
