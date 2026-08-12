-- ONE-OFF PRODUCTION REPAIR. THIS SCRIPT WRITES.
--
-- Take a fresh dump and rehearse this on a restored copy before running it
-- against prod. Everything is wrapped in a single transaction, so a failure
-- anywhere leaves the database untouched.
--
--   psql "$PRIVATE_DATABASE_URL" -P pager=off -v ON_ERROR_STOP=1 -f scripts/prod-repair.sql
--
-- ON_ERROR_STOP=1 matters: without it psql keeps going after an error and
-- COMMIT would land on a half-finished transaction.
--
-- WHAT WENT WRONG
--
-- The database role is named "drizzle" and its search_path is "$user", public.
-- The migrator's first act is CREATE SCHEMA IF NOT EXISTS drizzle, for its
-- bookkeeping table. That made "$user" resolve, so every later unqualified
-- CREATE TABLE landed in schema drizzle instead of public. Migration 0000 then
-- reaches its foreign keys, which drizzle-kit emits with a hardcoded
-- REFERENCES "public"."campaigns", and that relation does not exist. The run
-- aborted there, after the CREATE TABLEs, before the 7 foreign keys and the
-- 11 CREATE INDEX statements, and before anything was recorded in
-- __drizzle_migrations. The old entrypoint ignored the failure, so this has
-- repeated on every boot since.
--
-- This script moves the tables where the migrations expect them, applies the
-- statements that never ran, stops the schema hijack from recurring, and
-- records 0000 and 0001 as applied.
--
-- PREREQUISITES
--   - scripts/prod-orphan-check.sql returns 0 for every relationship.
--   - The role can CREATE in schema public. Postgres 15+ revokes that from
--     PUBLIC by default; if step 1 fails on permissions, run as superuser:
--       GRANT CREATE ON SCHEMA public TO drizzle;
--   - The app is stopped, or you accept brief lock contention.

BEGIN;

-- Step 1 needs ACCESS EXCLUSIVE on all 8 tables. Without a timeout, one slow
-- query in the running app makes this transaction queue for that lock while
-- every later reader queues behind it. Fail fast and retry instead.
SET LOCAL lock_timeout = '5s';

--
-- 1. Move the application tables into public, where the migrations expect them.
--    __drizzle_migrations stays in the drizzle schema, that is its correct home.
--    ALTER TABLE ... SET SCHEMA carries owned sequences along, so the serial id
--    sequences move too.
--
ALTER TABLE drizzle."campaigns" SET SCHEMA public;
ALTER TABLE drizzle."gameSessions" SET SCHEMA public;
ALTER TABLE drizzle."map_markers" SET SCHEMA public;
ALTER TABLE drizzle."navigation_paths" SET SCHEMA public;
ALTER TABLE drizzle."paths" SET SCHEMA public;
ALTER TABLE drizzle."revealed_tiles" SET SCHEMA public;
ALTER TABLE drizzle."time_audit_log" SET SCHEMA public;
ALTER TABLE drizzle."uploaded_images" SET SCHEMA public;

--
-- 2. Stop the hijack from happening again. Pinning search_path to public means
--    the drizzle schema no longer captures unqualified DDL, no matter that it
--    shares a name with the role. Takes effect for new sessions.
--
ALTER ROLE drizzle SET search_path = public;

--
-- 3. The 7 foreign keys from migration 0000 that never ran.
--
ALTER TABLE public."gameSessions" ADD CONSTRAINT "gameSessions_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES public."campaigns"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE public."map_markers" ADD CONSTRAINT "map_markers_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES public."campaigns"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE public."navigation_paths" ADD CONSTRAINT "navigation_paths_gameSession_id_gameSessions_id_fk" FOREIGN KEY ("gameSession_id") REFERENCES public."gameSessions"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE public."paths" ADD CONSTRAINT "paths_game_session_id_gameSessions_id_fk" FOREIGN KEY ("game_session_id") REFERENCES public."gameSessions"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE public."revealed_tiles" ADD CONSTRAINT "revealed_tiles_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES public."campaigns"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE public."time_audit_log" ADD CONSTRAINT "time_audit_log_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES public."campaigns"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE public."uploaded_images" ADD CONSTRAINT "uploaded_images_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES public."campaigns"("id") ON DELETE cascade ON UPDATE no action;

--
-- 4. The 11 indexes from migration 0000 that never ran.
--
CREATE INDEX "campaigns_slug_idx" ON public."campaigns" USING btree ("slug");
CREATE INDEX "campaigns_dm_token_idx" ON public."campaigns" USING btree ("dm_token");
CREATE INDEX "campaigns_player_token_idx" ON public."campaigns" USING btree ("player_token");
CREATE INDEX "game_sessions_campaign_id_idx" ON public."gameSessions" USING btree ("campaign_id");
CREATE INDEX "game_sessions_campaign_id_is_active_idx" ON public."gameSessions" USING btree ("campaign_id","is_active");
CREATE INDEX "game_sessions_campaign_id_session_number_idx" ON public."gameSessions" USING btree ("campaign_id","session_number");
CREATE INDEX "map_markers_campaign_id_idx" ON public."map_markers" USING btree ("campaign_id");
CREATE INDEX "paths_game_session_id_idx" ON public."paths" USING btree ("game_session_id");
CREATE INDEX "revealed_tiles_campaign_id_idx" ON public."revealed_tiles" USING btree ("campaign_id");
CREATE INDEX "time_audit_log_campaign_id_idx" ON public."time_audit_log" USING btree ("campaign_id");
CREATE INDEX "time_audit_log_campaign_id_timestamp_idx" ON public."time_audit_log" USING btree ("campaign_id","timestamp");

--
-- 5. Record 0000 and 0001 as applied, so the migrator no-ops on the next boot.
--    hash = sha256 of the migration file contents, matching what
--    readMigrationFiles computes (drizzle-orm/migrator.js). created_at = the
--    "when" values in drizzle/meta/_journal.json. Only the newest row is read,
--    but both are inserted so the table tells the truth.
--
INSERT INTO drizzle.__drizzle_migrations (hash, created_at) VALUES
  ('8ab122d82b5b15734ba615dc1b2b23d4cb84d20861c207b8179e238f203aaece', 1761657587936),
  ('267fc317ca3b4160d5d651252e2ddd3e20dd0ba219e6cef79782fa4bb904a0fd', 1761685865493);

COMMIT;

--
-- 6. Verify step 2 actually took. A role may only set its own options, and a
--    managed Postgres can silently leave that ungranted. Expect a row reading
--    {search_path=public}. An empty rolconfig means the hijack is still armed
--    and the next migration will fail the same way.
--
SELECT rolname, rolconfig
FROM pg_roles
WHERE rolname = 'drizzle';

-- Afterwards, re-run scripts/prod-schema-check.sql (verdict should read
-- "up to date - migrator will no-op") and scripts/prod-index-constraint-check.sql
-- (query G should show no MISSING rows).
--
-- Migration 0002 is deliberately NOT handled here. Its SQL was committed without
-- a journal entry or snapshot, so it is not yet a valid migration. Before
-- running `pnpm db:generate`, delete drizzle/0002_orange_hulk.sql: generate
-- diffs schema.ts against 0001_snapshot.json and emits its own 0002_<name>.sql,
-- so leaving the old file behind puts two unrelated migrations at index 0002
-- with only one of them journalled. Preconditions for the regenerated migration
-- are already clean (0 null titles, 0 duplicate marker groups).
