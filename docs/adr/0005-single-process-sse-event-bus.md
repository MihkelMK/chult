# 5. Single-process SSE event bus

Date: 2026-08-25

## Status

Accepted

## Decision

The realtime event bus runs in one process. The `EventEmitter`, the per-campaign replay buffers and the event sequence all live in that process's memory, so every client of a campaign must be connected to the same instance.

Event ids are namespaced by a per-process boot id, `BOOT_ID:sequence`, so a client reconnecting with an id from a previous run is told to resynchronise rather than handed a partial replay.

## Context

The bus carries deltas, not snapshots. A client that misses an event and is not told so stays wrong until it reloads, which is worse than being late.

Two properties are load-bearing and neither is visible from the code that depends on them.

**Everything is in-process.** `buffers`, `sequence` and the emitter are module-level state in `src/lib/server/events.ts`. If two instances run, an event emitted on one never reaches clients connected to the other, and no error appears anywhere. This holds today only because `compose.yml` pins `container_name`, which Docker will not accept alongside `replicas`. A correctness property is being enforced by a coincidence of deployment configuration.

**The sequence restarts at zero on every boot.** That makes an id meaningless outside the run that issued it. The replay path guarded the obvious case, an id above the current sequence, but not the overlap: after a restart, a client reconnecting with id 5 from the previous run fell below the new sequence and above nothing, so it received this run's events 6 onward and was treated as caught up, having missed everything in between. The window runs from restart until the sequence passes the highest id any reconnecting client holds, which is precisely when a crowd of clients reconnects at once.

## Consequences

The application cannot be scaled horizontally, and a rolling deploy that briefly runs two instances will silently drop events for whichever clients land on the outgoing one. Deploys must fully stop the old container before starting the new one.

Restarts are safe. A boot id mismatch takes the existing resync path, so a client holding state from a previous run refetches rather than patching. The cost is one extra `/data` fetch per client per restart.

That path is unreachable today, and deliberately so. Sessions are in-process too: `src/lib/server/session.ts` holds them in a module-level `Map`, with the Redis path commented out. A restart therefore drops every session, `requireAuth` rejects the reconnection with a `401` before the stream is constructed, and the client's `EventSource` closes without retrying. Clients are logged out rather than resynchronised, so the boot id is never compared. It is kept because it is defensive against precisely the change that comment anticipates: once sessions outlive the process, clients reconnect successfully after a restart and land straight in the window it closes. Whoever moves session storage should verify the resync path at the same time, since that change is what makes it reachable.

`replayAfter`'s `lastEventId > sequence` check is now unreachable, since cross-process ids are rejected earlier. It is kept as a cheap backstop rather than deleted.

Buffers are bounded per campaign and dropped when a campaign's last listener goes, so memory does not grow with uptime. Retaining fewer events than a client missed produces a resync, not a partial replay.

When a second instance is genuinely needed, the changes are: move the buffer and sequence to shared storage, replace the emitter with a shared bus, and turn `BOOT_ID` into a per-instance id. The frame format already accommodates the last of those.

## Alternatives considered

**Seed the sequence from `Date.now()` instead of a boot id.** `let sequence = Date.now()` in place of the boot id and its parse helper, roughly twenty-four fewer lines. Under the single-instance constraint above it is correct in every realistic case, and this was a close call rather than an obvious rejection.

It rests on two assumptions that nothing checks. It needs the process to average under one event per millisecond over its lifetime, or ids overtake the clock and a later run can reissue an earlier run's ids; this app is orders of magnitude below that, but the margin is invisible. It also has one hole: if the clock steps backwards by `d` milliseconds and the new run emits `d` events before a stale client reconnects, that client's id is no longer above `sequence` and the buffer's oldest id is no longer above it either, so neither guard fires and it receives a wrong replay. That needs a backwards step plus hundreds of events inside the five-second reconnect delay, so it is unlikely rather than impossible.

Rejected because both failure modes are silent when they occur, and because its correctness is an argument about clock direction and emission rate that is nowhere visible at the line where someone would reintroduce the bug. The boot id states the property instead of deriving it. That is the whole of the advantage; it does not depend on the two-instance case, which this ADR rules out by decision and which therefore cannot be used to justify it.

**A shared bus now**, Redis pub/sub or Postgres `LISTEN`/`NOTIFY`, removing the constraint rather than documenting it. Rejected as infrastructure for a problem this deployment does not have. One container serves one gaming group. The constraint is written down so the day it stops being true is a decision rather than a discovery.

**Persisting the sequence across restarts** so ids stay comparable. Rejected: it makes restarts require durable state to stay correct, and resynchronising after a restart is cheap.
