-- Read-only. Nothing here writes.
--
--   psql "$PRIVATE_DATABASE_URL" -P pager=off -f scripts/prod-orphan-check.sql
--
-- Prod has none of the 7 foreign keys that migration 0000 defines, so nothing
-- has been enforcing referential integrity. Before adding those constraints,
-- find rows whose parent no longer exists. Every count below must be 0, or the
-- ALTER TABLE ... ADD CONSTRAINT will fail (and roll back the repair).

SELECT 'gameSessions -> campaigns' AS relationship, count(*) AS orphan_rows
FROM drizzle."gameSessions" c
LEFT JOIN drizzle.campaigns p ON p.id = c.campaign_id
WHERE p.id IS NULL

UNION ALL SELECT 'map_markers -> campaigns', count(*)
FROM drizzle.map_markers c
LEFT JOIN drizzle.campaigns p ON p.id = c.campaign_id
WHERE p.id IS NULL

UNION ALL SELECT 'revealed_tiles -> campaigns', count(*)
FROM drizzle.revealed_tiles c
LEFT JOIN drizzle.campaigns p ON p.id = c.campaign_id
WHERE p.id IS NULL

UNION ALL SELECT 'time_audit_log -> campaigns', count(*)
FROM drizzle.time_audit_log c
LEFT JOIN drizzle.campaigns p ON p.id = c.campaign_id
WHERE p.id IS NULL

UNION ALL SELECT 'uploaded_images -> campaigns', count(*)
FROM drizzle.uploaded_images c
LEFT JOIN drizzle.campaigns p ON p.id = c.campaign_id
WHERE p.id IS NULL

UNION ALL SELECT 'navigation_paths -> gameSessions', count(*)
FROM drizzle.navigation_paths c
LEFT JOIN drizzle."gameSessions" p ON p.id = c."gameSession_id"
WHERE p.id IS NULL

UNION ALL SELECT 'paths -> gameSessions', count(*)
FROM drizzle.paths c
LEFT JOIN drizzle."gameSessions" p ON p.id = c.game_session_id
WHERE p.id IS NULL;
