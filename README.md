# chult

Interactive hex crawler map with DM and Player views.\
Players see the hexes they have uncovered. The DM sees the whole map and decides what to reveal, in real time.

Runs on SvelteKit, Drizzle ORM and Postgres.

## Source of truth

I develop this on a private Forgejo instance. **This GitHub repo is a read-only mirror**, kept current by a push mirror.

I read issues and pull requests you open here. Merges happen by hand on Forgejo side, mirror carries them back. Your commits keep your authorship, though GitHub may mark pull request closed instead of merged. See [CONTRIBUTING.md](./CONTRIBUTING.md).

## Development

Requires Node and [pnpm](https://pnpm.io).

```sh
pnpm install
cp .env.example .env    # fill in the values
pnpm db:migrate
pnpm dev
```

Use `compose-dev.yml` for a full local stack in Docker, `compose.yml` for production.

## Checks

```sh
pnpm lint      # prettier --check + eslint
pnpm check     # svelte-check
pnpm build     # production build
```

## License

GPL-3.0-only. See [LICENSE](./LICENSE).
