-- Read-only follow-up to prod-schema-check.sql. Nothing here writes.
--
--   psql "$PRIVATE_DATABASE_URL" -f scripts/prod-schema-baseline-check.sql
--
-- Purpose: prod's drizzle.__drizzle_migrations is empty, yet the tables exist.
-- Before baselining that table we must confirm prod's schema really equals the
-- state that migrations 0000 + 0001 produce, and find out which schema the app
-- tables actually live in.

\echo '== A. Who are we and what is the search_path? =='
-- prod-schema-check.sql reported map_markers in schema "drizzle", not public.
-- Likely cause: the role is named drizzle, so the "$user" entry in search_path
-- resolves to the drizzle schema that the migrator created, and every
-- unqualified CREATE TABLE landed there instead of public.
SELECT current_user,
       current_schema() AS default_create_schema,
       current_schemas(TRUE) AS effective_search_path;

\echo '== B. Every non-system table, with its schema =='
SELECT schemaname,
       tablename,
       tableowner
FROM pg_tables
WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
ORDER BY schemaname, tablename;

\echo '== C. Is prod at the post-0001 state? =='
-- 0001 adds campaigns.has_player_map. Present = prod includes 0001.
-- Absent = prod is older than the journal head and baselining would skip real work.
SELECT table_schema,
       table_name,
       column_name,
       data_type,
       is_nullable,
       column_default
FROM information_schema.columns
WHERE table_name = 'campaigns'
ORDER BY table_schema, ordinal_position;

\echo '== D. Full column list for the tables 0000 creates =='
SELECT table_schema,
       table_name,
       column_name,
       data_type,
       is_nullable
FROM information_schema.columns
WHERE table_schema NOT IN ('pg_catalog', 'information_schema')
ORDER BY table_schema, table_name, ordinal_position;

\echo '== E. Would 0002 apply cleanly if we journal it properly later? =='
-- 0002 sets map_markers.title NOT NULL. Any NULL title blocks that.
SELECT count(*) AS null_titles
FROM map_markers
WHERE title IS NULL;

\echo '== F. Same, unique-index half of 0002 =='
-- 0002 adds one unique index per visibility flag over (campaign_id, x, y).
-- Any group with count > 1 blocks index creation.
SELECT campaign_id,
       x,
       y,
       visible_to_players,
       count(*) AS duplicates
FROM map_markers
GROUP BY campaign_id, x, y, visible_to_players
HAVING count(*) > 1
ORDER BY duplicates DESC;
