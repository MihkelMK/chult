# Wayfinding operations

Used by `/wayfinder`. Tracker conventions are in `docs/agents/issue-tracker.md`.

The **map** is a single issue with **child** issues as tickets.

- **Map**: single issue labelled `wayfinder:map`, holding Notes / Decisions-so-far / Fog body. Create with `tea issue create --labels wayfinder:map`.
- **Child ticket**: issue carrying `Part of #<map>` at top of description and a `wayfinder:<type>` label (`research` / `prototype` / `grilling` / `task`). Dev who claims it assigns it to themselves.
- **Blocking**: Forgejo has native dependencies (Depends on / Blocks) in issue sidebar. `tea` cannot set them, so use `Blocked by: #<n>, #<n>` line at top of description as canonical form. Ticket unblocked when every blocker closed.
- **Frontier query**: `tea issues list --output json`, scoped to map's children. Drop any with open issue in its `Blocked by` line, or with assignee. First in map order wins.
- **Claim**: `tea issue edit <n> --add-assignees <me>`, session's first write.
- **Resolve**: `tea comment <n> "<answer>"`, then `tea issue close <n>`, then append context pointer to map's Decisions-so-far.
