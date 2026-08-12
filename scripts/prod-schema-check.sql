-- Read-only pre-deploy check for the drizzle-kit -> drizzle-orm migrator switch.
-- Nothing here writes; safe to run against production.
--
-- Run with:
--   psql "$PRIVATE_DATABASE_URL" -f scripts/prod-schema-check.sql
-- Query 2 errors out if the drizzle schema does not exist. That error is itself
-- the answer (see the note under query 1), and psql continues to the next query.

\echo '== 1. Where does the migration bookkeeping table live? =='
-- Expect exactly one row: drizzle | __drizzle_migrations.
-- The new migrator defaults to schema "drizzle", table "__drizzle_migrations"
-- (drizzle-orm/pg-core/dialect.js). No rows, or a different schema, means it
-- will replay migration 0000 from scratch and fail on CREATE TABLE.
SELECT n.nspname AS schema_name,
       c.relname AS table_name
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE c.relname = '__drizzle_migrations';

\echo '== 2. Which migrations does prod think it has applied? =='
-- Expect two rows, created_at 1761657587936 and 1761685865493 — the "when"
-- values in drizzle/meta/_journal.json.
SELECT id,
       created_at,
       to_timestamp(created_at / 1000) AS applied_at,
       hash
FROM drizzle.__drizzle_migrations
ORDER BY created_at;

\echo '== 3. Verdict: will the new migrator try to apply anything? =='
-- The migrator reads only the newest row and applies every journal entry whose
-- "when" is greater than it. Journal head is currently 1761685865493, so
-- "up to date - migrator will no-op" is the expected result.
SELECT MAX(created_at) AS newest_applied,
       1761685865493 AS journal_head,
       CASE
         WHEN MAX(created_at) IS NULL THEN 'EMPTY TABLE - migrator would replay 0000 and fail'
         WHEN MAX(created_at) < 1761685865493 THEN 'BEHIND - migrator would apply pending migrations'
         WHEN MAX(created_at) > 1761685865493 THEN 'AHEAD - prod applied something not in the journal'
         ELSE 'up to date - migrator will no-op'
       END AS verdict
FROM drizzle.__drizzle_migrations;

\echo '== 4. Did the un-journalled 0002 migration ever reach prod? =='
-- drizzle/0002_orange_hulk.sql has no journal entry and no snapshot, so no
-- migrator has ever applied it. If prod got it, it was via `drizzle-kit push`.
-- Expect map_markers_dm_unique_idx and map_markers_player_unique_idx present.
SELECT indexname,
       indexdef
FROM pg_indexes
WHERE tablename = 'map_markers'
ORDER BY indexname;

\echo '== 5. Same question, NOT NULL half of 0002 =='
-- Expect attnotnull = true if 0002 reached prod.
SELECT attname AS column_name,
       attnotnull AS is_not_null
FROM pg_attribute
WHERE attrelid = 'map_markers'::regclass
  AND attname = 'title';

\echo '== 6. Table inventory, for eyeballing against schema.ts =='
SELECT tablename
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;
