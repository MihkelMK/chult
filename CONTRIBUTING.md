# Contributing

I welcome contributions.

## Where this repo lives

I develop this on a private Forgejo instance; GitHub is a read-only mirror. That has two consequences for you:

- **CI does not run on GitHub pull requests yet.** The pipeline lives in `.forgejo/`. Run the checks below on your machine before you open a pull request.
- **I merge your pull request by hand** on the Forgejo side, and the mirror carries it back. Your commits keep your authorship, though GitHub may mark the pull request closed rather than merged. The merge comment will confirm it landed.

## Setup

Requires Node and [pnpm](https://pnpm.io).

```sh
pnpm install
cp .env.example .env    # fill in the values
pnpm db:migrate
pnpm dev
```

## Before opening a pull request

```sh
pnpm lint
pnpm check
pnpm build
```

All three must pass. `pnpm format` fixes most lint complaints.

## Guidelines

- One concern per pull request. Split a wide change into several.
- Follow the patterns already in the surrounding code.
- Open an issue first for anything large, so we can agree on the approach before you spend time on it.
- Keep `.env`, database dumps, and anything from `uploads/` or `backups/` out of your commits.

## Using an AI agent

`AGENTS.md` at the repo root describes this project for coding agents. Point your agent at it, and read the "Where you are" section at the top: it tells your agent what to skip. The issue-tracker instructions under `docs/agents/` cover the private Forgejo tracker, which you cannot reach. Your agent should skip them and use GitHub.

## License

By contributing you agree your work is licensed under GPL-3.0-only, the same as the rest of the project.
