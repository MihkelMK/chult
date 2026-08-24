# Prod schema rescue

Prod's `drizzle.__drizzle_migrations` is empty while the tables exist, so\
the fail-closed migrator would replay `0000` and refuse to start.

`scripts/prod-repair.sql` documents the root cause and the repair.

Everything below uses database `drizzle` and role `drizzle`, matching prod.\
The role name is load-bearing: the bug depends on it colliding with the schema\
name the migrator creates, so the rehearsal must reproduce it.

## Rehearsal, end to end

1. Throwaway Postgres on its own network, same image as prod

   ```sh
   docker network create chult-test

   docker run -d --name chult-migrate-test --network chult-test \
     -e POSTGRES_USER=drizzle -e POSTGRES_PASSWORD=test -e POSTGRES_DB=drizzle \
     -p 55432:5432 postgres:18.3-alpine3.23@sha256:4da1a4828be12604092fa55311276f08f9224a74a62dcb4708bd7439e2a03911
   ```

2. Restore the real backup artifact

   Use the file the backup service produces, not a hand-rolled `pg_dump`.\
   This step doubles as proof that the rollback path works.

   ```sh
   zcat "${DOCKER_DATA}"/chult/backups/last/*-latest.sql.gz \
     | docker exec -i chult-migrate-test psql -U drizzle -d drizzle
   ```

3. Confirm the copy reproduces the bug

   ```sh
   docker exec -i chult-migrate-test psql -U drizzle -d drizzle -P pager=off \
     < scripts/prod-schema-check.sql          # expect: EMPTY TABLE verdict
   ```

4. Repair

   ```sh
   docker exec -i chult-migrate-test psql -U drizzle -d drizzle -P pager=off \
     -v ON_ERROR_STOP=1 < scripts/prod-repair.sql
   ```

   Expect the trailing `rolconfig` row to read `{search_path=public}`.\
   Empty `rolconfig` means step 2 of the repair did not take and the hijack is still armed.

5. Verify

   ```sh
   docker exec -i chult-migrate-test psql -U drizzle -d drizzle -P pager=off \
     < scripts/prod-schema-check.sql          # expect: up to date - migrator will no-op
   docker exec -i chult-migrate-test psql -U drizzle -d drizzle -P pager=off \
     < scripts/prod-index-constraint-check.sql # expect: no MISSING rows
   ```

6. The migrator must do nothing

   ```sh
   docker build -t chult:test .

   docker exec chult-migrate-test pg_dump -U drizzle -d drizzle --schema-only > /tmp/before.sql
   docker run --rm --network chult-test --entrypoint node \
     -e PRIVATE_DATABASE_URL="postgresql://drizzle:test@chult-migrate-test:5432/drizzle" \
     chult:test /app/scripts/migrate.js
   docker exec chult-migrate-test pg_dump -U drizzle -d drizzle --schema-only > /tmp/after.sql

   diff /tmp/before.sql /tmp/after.sql
   ```

   Two lines will differ: `\restrict` and `\unrestrict` nonces described in step 7.\
   Nothing else may.

7. Independent cross-check

   Build a database from the migrations alone, under a role that doesn't\
   trigger the hijack, then diff against the repaired one.

   ```sh
   docker exec chult-migrate-test createdb -U drizzle fresh
   docker exec chult-migrate-test psql -U drizzle -d fresh -c \
     "CREATE ROLE app LOGIN PASSWORD 'test';
      GRANT CREATE ON DATABASE fresh TO app;
      GRANT ALL ON SCHEMA public TO app;"

   docker run --rm --network chult-test --entrypoint node \
     -e PRIVATE_DATABASE_URL="postgresql://app:test@chult-migrate-test:5432/fresh" \
     chult:test /app/scripts/migrate.js

   docker exec chult-migrate-test pg_dump -U drizzle -d fresh --schema-only > /tmp/fresh.sql
   diff /tmp/after.sql /tmp/fresh.sql
   ```

   You need both grants. They cover unrelated privileges:
   - `CREATE ON DATABASE` lets the role run `CREATE SCHEMA`, the migrator's first statement.\
      Without it: `permission denied for database fresh` on\
     `CREATE SCHEMA IF NOT EXISTS "drizzle"`.
   - `CREATE ON SCHEMA public` lets it run `CREATE TABLE` there.\
      Postgres 15+ revoked that from `PUBLIC`, so without it the first table fails.

   Prod needs neither.\
   Role `drizzle` owns database `drizzle` and holds both privileges through ownership.

   `CREATE ROLE` is cluster-wide, so a retry against a surviving container errors\
   with `role "app" already exists`. Drop the `CREATE ROLE` and keep the grants.

   This run also proves `0000` is sound.\
   Under a role named `app`, `"$user"` does not resolve, tables land in `public`,\
   and the foreign keys referencing `public.campaigns` succeed.

   Expect three categories of difference and nothing else:
   - **Ownership.**
     - `Owner: drizzle` against `Owner: app` in comments
     - Matching `ALTER ... OWNER TO` lines
     - A trailing `GRANT ALL ON SCHEMA public TO app` ACL block only in `fresh`.
   - **`\restrict` / `\unrestrict` nonces.**\
      Postgres 18 `pg_dump` wraps output in these meta-commands so a hostile\
      object name cannot inject psql backslash commands into a restore.\
      The token is random per invocation, so two dumps of an identical\
      database always differ on those two lines.
   - **Column ordinal position of `campaigns.has_player_map`.**\
      `fresh`: has it last. `0001` adds it with `ALTER TABLE ... ADD COLUMN` and pg appends.\
      Prod: between `image_height` and `global_game_time`, matching order in `schema.ts`.

     `drizzle-kit push` built prod's tables from `schema.ts`, migration files never did.\
      That also explains the empty `__drizzle_migrations` alongside post-`0001` columns.

   The ordinal difference is permanent and harmless.

   Postgres has no `ALTER TABLE ... SET ORDER`, and only a table rebuild changes `attnum`.\
   Nothing depends on it:\
   drizzle-orm emits explicit column lists for `SELECT` and `INSERT`.\
   No raw `SELECT *` appears anywhere in `src/`.

   The journal drives both databases and has no `0002` entry.\
   Neither one carries the nullable `title` fix or its two unique indexes.\
   Treat any structural difference beyond the three above as a real problem\
   rather than the known 0002 gap.

8. Boot the actual app against the repaired database

   A passing migrator does not prove the ORM's unqualified queries still\
   resolve after the tables changed schema. This step does.

   ```sh
   docker run --rm --name chult-app-test --network chult-test -p 3000:3000 \
     -e POSTGRES_HOST=chult-migrate-test \
     -e POSTGRES_USER=drizzle -e POSTGRES_PASSWORD=test -e POSTGRES_DB=drizzle \
     -e DM_TOKEN=test -e IMGPROXY_KEY=00 -e IMGPROXY_SALT=00 \
     -e IMGPROXY_URL=http://localhost \
     chult:test
   ```

   Expect "Migrations applied." then "Starting the application...",\
   then load a campaign page.

   Without the uploads directory mounted, the map renders the `MapEmpty` placeholder:\
   "The campaign map is being prepared by your DM."\
   `getMapUrls` (`src/lib/server/imgproxy.ts`) gates on an `existsSync` for `./uploads/<slug>/map.jpg`.\
   That placeholder reports a missing file and touches no database.

   Reaching the placeholder proves what this step tests.\
   `MapView.svelte` renders it from `data.campaign.slug`, so `getCampaignById`\
   returned a populated row.

   It renders only after the load function's `Promise.all` in `src/lib/server/campaign.ts`\
   resolves, covering `revealedTiles`, `mapMarkers`, `gameSessions`, `navigationPaths`\
   and `timeAuditLog`.

   `Promise.all` rejects on any rejection, so all of those unqualified table\
   references resolved to `public` under the pinned `search_path`.

   To test UI, mount a _copy_ of the uploads dir read-write:\
   `-v /path/to/uploads-copy:/app/uploads`.

9. Write path: sequences, defaults, foreign keys

   Step 8 proves reads. It leaves two things unproven:\
   that serial sequences still work after riding along with `ALTER TABLE ... SET SCHEMA`,\
   and that the seven restored foreign keys enforce.

   Run this without `-v ON_ERROR_STOP=1`. It provokes a foreign key violation on purpose.\
   With it set, psql exits on that error, so the `SAVEPOINT` never gets rolled back to\
   and the rest of the script never runs.

   `ON_ERROR_STOP` and `SAVEPOINT` do not compose:\
   a savepoint recovers inside a session, the flag ends the session.\
   Set the flag for repair scripts, clear it for probe scripts that read an error as data.

   ```sh
   docker exec -i chult-migrate-test psql -U drizzle -d drizzle -P pager=off \
     < scripts/prod-write-check.sql
   ```

   Expect an `id` above the current maximum with `has_player_map` false and\
   a populated `created_at`, then `child_before = 1`, then\
   `ERROR: insert or update on table "revealed_tiles" violates foreign key constraint "revealed_tiles_campaign_id_campaigns_id_fk"`, \
   then `orphans_left = 0`.\
   The closing `ROLLBACK` leaves the database untouched.

   `id` colliding with an existing row: schema move left the sequence behind or reset it.\
   A `DELETE` that errors instead of succeeding: the cascade clause did not survive.

## Prod

1. Fresh backup, from the same service that writes daily backups

   ```sh
   docker exec chult-prod_backup /backup.sh
   ```

2. Orphan check

   ```sh
   docker exec -i chult-prod_postgres psql -U drizzle -d drizzle -P pager=off \
     < scripts/prod-orphan-check.sql          # expect: 0 in every orphan_rows cell
   ```

   Run this before the repair, never after.\
   It qualifies every table as `drizzle.*`.

3. Run the repair

   ```sh
   docker exec -i chult-prod_postgres psql -U drizzle -d drizzle -P pager=off \
     -v ON_ERROR_STOP=1 < scripts/prod-repair.sql
   ```

   If step 1 of the repair fails on permissions, Postgres 15+ has revoked `CREATE` on `public`.\
   Grant it as superuser and rerun.

   The whole script is one transaction, so the failed attempt changed nothing:

   ```sh
   docker exec -i chult-prod_postgres psql -U postgres -d drizzle \
     -c "GRANT CREATE ON SCHEMA public TO drizzle;"
   ```

4. Re-verify

   ```sh
   docker exec -i chult-prod_postgres psql -U drizzle -d drizzle -P pager=off \
     < scripts/prod-schema-check.sql          # expect: up to date - migrator will no-op
   docker exec -i chult-prod_postgres psql -U drizzle -d drizzle -P pager=off \
     < scripts/prod-index-constraint-check.sql # expect: no MISSING rows
   ```

5. Restart both app containers

   They have been failing on `node /app/scripts/migrate.js` since the\
   fail-closed entrypoint shipped in PR #100 (`dd0a24d`).\
   With `0000` and `0001` recorded, the migrator no-ops and the app boots.

## Rollback

The backup dumps carry no `--clean`, so they contain no `DROP` statements and\
will not restore over a populated database.

Restore into a new database and repoint the app.

## Afterwards: migration 0002

The repair leaves this one alone.

`drizzle/0002_orange_hulk.sql` landed in the repo without a journal entry or snapshot.\
No migrator has ever applied it and prod lacks its NOT NULL and two unique indexes.

```sh
rm drizzle/0002_orange_hulk.sql   # else generate emits a second file at index 0002
pnpm db:generate
```

Prod's preconditions are clean (0 null titles, 0 duplicate marker groups).\
The regenerated migration applies on the next deploy.

`scripts/prod-index-constraint-check.sql` will then report the two new indexes\
as `EXTRA` until you update its expected-index list.
