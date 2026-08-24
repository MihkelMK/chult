-- Read-only. Nothing here writes.
--
--   psql "$PRIVATE_DATABASE_URL" -P pager=off -f scripts/prod-index-constraint-check.sql
--
-- The column inventory matched migrations 0000 + 0001, but map_markers has only
-- its primary key while 0000 also creates map_markers_campaign_id_idx. So prod
-- is NOT simply "post-0001" and must not be baselined until the real delta is
-- known. This lists every index and constraint prod has, and diffs the index
-- set against what 0000 + 0001 produce.

\echo '== G. Indexes prod has, versus what 0000 + 0001 create =='
-- status column: MISSING = 0000/0001 creates it, prod lacks it.
--                EXTRA   = prod has it, migrations do not create it.
--                ok      = present in both.
WITH expected(indexname) AS (
  VALUES
    -- primary keys
    ('campaigns_pkey'),
    ('gameSessions_pkey'),
    ('map_markers_pkey'),
    ('navigation_paths_pkey'),
    ('paths_pkey'),
    ('revealed_tiles_pkey'),
    ('time_audit_log_pkey'),
    ('uploaded_images_pkey'),
    -- unique constraints on campaigns
    ('campaigns_slug_unique'),
    ('campaigns_dm_token_unique'),
    ('campaigns_player_token_unique'),
    -- explicit CREATE INDEX statements at the end of 0000
    ('campaigns_slug_idx'),
    ('campaigns_dm_token_idx'),
    ('campaigns_player_token_idx'),
    ('game_sessions_campaign_id_idx'),
    ('game_sessions_campaign_id_is_active_idx'),
    ('game_sessions_campaign_id_session_number_idx'),
    ('map_markers_campaign_id_idx'),
    ('paths_game_session_id_idx'),
    ('revealed_tiles_campaign_id_idx'),
    ('time_audit_log_campaign_id_idx'),
    ('time_audit_log_campaign_id_timestamp_idx'),
    -- created by the migrator itself
    ('__drizzle_migrations_pkey')
),
actual AS (
  SELECT indexname
  FROM pg_indexes
  WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
)
SELECT COALESCE(e.indexname, a.indexname) AS indexname,
       CASE
         WHEN a.indexname IS NULL THEN 'MISSING'
         WHEN e.indexname IS NULL THEN 'EXTRA'
         ELSE 'ok'
       END AS status
FROM expected e
FULL OUTER JOIN actual a ON a.indexname = e.indexname
ORDER BY status, indexname;

\echo '== H. Every constraint prod has =='
-- 0000 adds 7 foreign keys plus the primary keys and the three campaigns
-- unique constraints. Anything missing here is real schema drift.
SELECT n.nspname AS schema_name,
       t.relname AS table_name,
       c.conname AS constraint_name,
       CASE c.contype
         WHEN 'p' THEN 'primary key'
         WHEN 'f' THEN 'foreign key'
         WHEN 'u' THEN 'unique'
         WHEN 'c' THEN 'check'
         ELSE c.contype::text
       END AS constraint_type,
       pg_get_constraintdef(c.oid) AS definition
FROM pg_constraint c
JOIN pg_class t ON t.oid = c.conrelid
JOIN pg_namespace n ON n.oid = t.relnamespace
WHERE n.nspname NOT IN ('pg_catalog', 'information_schema')
ORDER BY t.relname, c.contype, c.conname;

\echo '== I. Full index definitions, for eyeballing column order =='
SELECT schemaname,
       tablename,
       indexname,
       indexdef
FROM pg_indexes
WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
ORDER BY tablename, indexname;
