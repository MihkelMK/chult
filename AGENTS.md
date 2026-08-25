# AGENTS.md

Interactive hex crawler map, DM and Player views. SvelteKit, Drizzle, Postgres.

## Where you are

Truth source = private Forgejo instance. GitHub repo read-only mirror.

**Check first:** if `git remote -v` points at github.com you are on the mirror. Then:

- Skip "Issue tracker" section below. You cannot reach that tracker, and its commands will fail. Do not run them.
- Open GitHub issue or pull request instead. See `CONTRIBUTING.md`.
- Other sections apply as written.

## Agent skills

### Issue tracker

Issues live in Forgejo, driven by `tea` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

Five canonical labels, used unchanged: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`.

### Domain docs

Single-context. Domain docs belong at `CONTEXT.md` and `docs/adr/` in repo root; neither exists yet. See `docs/agents/domain.md`.
