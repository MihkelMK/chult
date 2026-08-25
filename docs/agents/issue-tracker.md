# Issue tracker: Forgejo

**Check first:** if `git remote -v` points at github.com you are on the public read-only mirror. This file does not apply to you: you cannot reach the tracker it describes. Open a GitHub issue or pull request instead. See `CONTRIBUTING.md`.

Issues and specs for this repo live as issues on private Forgejo instance. Use [`tea`](https://gitea.com/gitea/tea) (Gitea CLI, same API as Forgejo) for all operations.

## Setup

Maintainer installs `tea` if missing, then logs in once against Forgejo host from `git remote -v`:

```bash
tea login add --name chult --url <forgejo-url> --token <token>
```

Create token in Forgejo (Settings → Applications), at least `issue` and `repository` scopes. After login, `tea` infers repo from `git remote -v` when run inside clone.

If no `tea`, fall back to Forgejo web UI: draft issue body as markdown, hand to maintainer to paste. Do not skip tracker step.

## Conventions

- **Create an issue**: `tea issue create --title "..." --description "..."`. No `--description-file` in tea 0.15.1: pass multi-line bodies as `--description "$(cat body.md)"`.
- **Read an issue**: `tea issue <number> --comments`.
- **List issues**: `tea issues list --output json`. Filter with `--labels`, `--state`, `--assignee` as needed.
- **Comment on an issue**: `tea comment <number> "..."`.
- **Apply / remove labels**: labels comma-separated. `tea issue edit <number> --add-labels "a,b"` / `--remove-labels "a,b"`
- **Assign**: `tea issue edit <number> --add-assignees <user>`.
- **Close**: `tea issue close <number>`. Takes no closing comment, so post explanation first with `tea comment <number> "..."`, then close.
- **Manage the label set**: `tea labels list`, `tea labels create --name "..." --color "..."`.
- **Pull requests**: `tea pr create`, `tea pr list`, `tea pr <number>`, `tea pr close`. Forgejo numbers issues and pull requests in one shared sequence, so `#42` may be either.

Confirm exact flags with `tea <command> --help` before first write. This file records `tea` as of current release.

## The GitHub mirror

When GitHub issue matters, maintainer copies it into Forgejo with a `Reported at: <github-url>` line.

## Pull requests as a triage surface

**PRs as a request surface: no.** _(Set to `yes` if this repo treats external pull requests as feature requests; `/triage` reads this flag.)_

When `yes`, PRs run through same labels and states as issues, using the `tea pr` commands above. Labels are shared between issues and PRs.

## When a skill says "publish to the issue tracker"

Create Forgejo issue.

## When a skill says "fetch the relevant ticket"

Run `tea issue <number> --comments`.

## Wayfinding operations

Used by `/wayfinder` only. See `docs/agents/wayfinder.md`.
