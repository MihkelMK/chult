# Bug Tracker

Active bugs and specified features now live as issues on Forgejo. Check there before adding anything here: `tea issues list`.

This file holds two things: a record of fixed bugs worth remembering, and feature ideas not yet shaped well enough to be tickets.

## Fixed

- ~~POST `/api/campaigns/[slug]/markers` `visibleToPlayers` validation is inverted~~
  - `if (!visibleToPlayers && typeof visibleToPlayers !== 'boolean')` let truthy non-booleans (`"yes"`, `1`, `{}`) pass, and rejected `undefined` even though `requestedVisibility = visibleToPlayers ?? true` expects `undefined` to mean "default true"
  - Was masked in practice because the client always sends a boolean
  - Fixed: `if (visibleToPlayers !== undefined && typeof visibleToPlayers !== 'boolean') error(400, ...)`
- ~~API catch blocks swallow every `error()` status and return 500~~
  - `err instanceof Error` is never true for SvelteKit's `HttpError`. It is a plain class, not an `Error` subclass
  - So `if (err instanceof Error && 'status' in err) throw err` (and the `err.message.includes('Invalid')` variant in map/settings) never matched, and every 400/403/404 thrown inside a `try` came back as 500
  - Affected: `map/settings`, `movement/player`, `movement/dm/teleport`, `sessions/start`, `sessions/end`, `sessions/[id]`
  - Fixed by using `isHttpError(err)` (CODE_GUIDE.md Pattern 12)

## Feature Requests

Not yet tickets: each needs a shape before anyone can pick it up.

- update sidebar, add PoI
- drawing tools
- note tools?
- track expedition
  - players can start
  - if session starts and expedition active, add session under expedition
  - else add to "downtime"
  - one path per session
  - track people on expedition
    - track consumables
- random encounter counter for DM (like wild magic)
- allow moving map tokens
- allow searching map token name and contents
- Location ping (animated rings growing from the cursor. Sent from one user to all other users)
