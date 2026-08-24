-- Post-repair write-path probe. Rehearsal only, never prod.
--
-- Run WITHOUT -v ON_ERROR_STOP=1:
--
--   psql "$URL" -P pager=off -f scripts/prod-write-check.sql
--
-- This script provokes a foreign key violation on purpose. With ON_ERROR_STOP=1
-- psql exits on that error, so ROLLBACK TO never runs and the rest of the script
-- is skipped. ON_ERROR_STOP and SAVEPOINT do not compose: a savepoint recovers
-- inside a session, the flag ends the session. Repair scripts want the flag on,
-- probe scripts that treat an error as data want it off.
--
-- Everything is wrapped in a transaction that ends in ROLLBACK, so the database
-- is left untouched either way.
--
-- WHAT THIS PROVES
--
-- Booting the app proves reads resolve to public after the repair. It does not
-- prove the serial sequences still work after riding along with
-- ALTER TABLE ... SET SCHEMA, nor that the 7 restored foreign keys enforce.

BEGIN;

-- Sequence still reachable after the schema move, column defaults still fire.
-- An id colliding with an existing row would mean the sequence was left behind
-- or reset.
INSERT INTO campaigns (name, slug, dm_token, player_token)
VALUES ('rescue-test', 'rescue-test', 'rt-dm', 'rt-player')
RETURNING id, has_player_map, created_at;

-- Foreign key accepts a valid parent.
INSERT INTO revealed_tiles (campaign_id, x, y)
VALUES ((SELECT id FROM campaigns WHERE slug = 'rescue-test'), 1, 1);

SELECT count(*) AS child_before
FROM revealed_tiles
WHERE campaign_id = (SELECT id FROM campaigns WHERE slug = 'rescue-test');

-- Foreign key rejects an invalid parent. The error is the pass condition:
--   ERROR: insert or update on table "revealed_tiles" violates foreign key
--   constraint "revealed_tiles_campaign_id_campaigns_id_fk"
SAVEPOINT s;
INSERT INTO revealed_tiles (campaign_id, x, y) VALUES (999999, 1, 1);
ROLLBACK TO s;

-- ON DELETE cascade reaches the child. A DELETE that errors on the constraint
-- instead of succeeding would mean the cascade clause did not survive.
DELETE FROM campaigns WHERE slug = 'rescue-test';

SELECT count(*) AS orphans_left
FROM revealed_tiles r
LEFT JOIN campaigns c ON c.id = r.campaign_id
WHERE c.id IS NULL;

ROLLBACK;
