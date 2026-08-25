# 2. Documentation structure

Date: 2026-08-25

## Status

Accepted

## Context

`CODE_GUIDE.md` is 1074 lines and mixes four kinds of document with different readers, different lifespans and different failure modes:

- **Normative rules**: batch mutations and trigger reactivity once, throw through `isHttpError`, wrap multi-table writes in a transaction.
- **Decisions with rationale**: why Konva, why no fog culling, why layer caching was removed after being tried.
- **Orientation**: a file tree and a list of key files with their responsibilities.
- **Retrospective history**: a before-and-after metrics table and fifteen numbered lessons from one optimisation pass.

Mixed in one file they rot as a unit, and they have.

The file tree is wrong in most of what was checked: `components/map/MapCanvas.svelte` is `components/canvas/`, `components/map/tokens/PartyToken.svelte` does not exist, and the document nests `api/` under `(campaign)/[slug]` when `routes/api` is top level. The table of contents lists eleven sections; the file has thirteen.

The retrospective content is worse than stale. "Performance Metrics Achieved" asserts that Konva renders 6,192 shapes in under 5ms, and "When Optimization is NOT Worth It" closes with "Profile the actual bottleneck. Don't optimize based on theory." A reader arrives believing rendering is solved, while issues #117 and #120 exist because scroll zoom and pan are not performant. The "For LLM Agents" section then instructs an agent to trust those patterns and not to suggest optimisations without data, aimed at the part of the document that is most confident and least correct.

There is also heavy internal duplication: Lesson 11 restates Design Decision 7, Lesson 12 restates Anti-Pattern 8, Lesson 13 restates Pattern 11, and Anti-Pattern 4 restates Design Decision 6.

## Decision

**Three kinds of artifact, not four.**

**Standards** live in `docs/standards/`, split by layer into `server.md`, `state.md` and `canvas.md`. Each pairs a rule with the anti-pattern it exists to prevent, rather than keeping rules and anti-patterns in separate lists, which is where most of the duplication came from. Someone touching an endpoint reads one file rather than a third of three.

**Decisions** live in `docs/adr/`, one per decision.

**Orientation gets no document.** An annotation explaining what a file is for describes either a name that does not say what the file does, or a file that does too many things. `MapCanvasWrapper` names a position in a hierarchy rather than a responsibility. `remoteStateDM.svelte.ts` is 660 lines of API batching, not a state store. `MapView.svelte` is 1125 lines and is the document's own example under Anti-Pattern 11, "God Components". Those become renames and splits, not a maintained tree. Where a constraint can be enforced by the compiler it should be: `fix/realtime-sync` derives server emitters and client listeners from one `CAMPAIGN_EVENTS` union so an unhandled event fails to compile, which is better than any sentence describing the same rule.

**Retrospective history is not kept as a section.** Evidence that justifies a surviving rule moves into that rule or into the ADR that decides it. The measurements behind not culling fog belong in that ADR's consequences, framed as a cost accepted for gameplay integrity rather than as a claim that rendering is fast. The before-and-after improvement table goes.

**Measurements return only as counts.** Wall-clock figures in documentation are false the moment hardware changes and cannot be checked by a reader. Counts of work survive: object allocations per update, SSE handler invocations per batch. When benchmarking tooling exists, the numbers it produces may be cited again.

**`CODE_GUIDE.md` is deleted** in the same commit that lands the last standards file. Its history remains in git. An archive nobody maintains is a second source of truth, which is the problem this decision exists to remove.

## Consequences

The standards files are written after `fix/realtime-sync` and the hex contract step, #126, have landed. Every sample worth keeping currently shows either pre-ADR-0001 spellings or pre-`realtime-sync` event handling, so writing them earlier means writing samples of code that does not exist, and writing them from today's code means they are born stale.

Until then `CODE_GUIDE.md` stays in `.dev_docs/`, untracked and unreferenced by any ADR. It is not a document a contributor can read, so nothing may depend on it.

`code-review`'s Standards axis gains real input. It currently looks for documented coding standards and finds `CONTRIBUTING.md`, which is contributor process.

Three renames and one component split fall out of dropping the orientation document. They are sequenced after `fix/realtime-sync` and #124, both of which rewrite the same store files.

## Alternatives considered

**Move `CODE_GUIDE.md` to `docs/` unchanged.** Rejected: it is stale in its most confident sections and long enough that nobody will read it to find the three rules that apply to their change.

**Split by concern** rather than by layer: performance, error handling, state. Rejected: concerns cut across every file someone touches, so a reader has to consult all of them.

**One shorter `docs/STANDARDS.md`.** Rejected as the thing that just failed. A single file accumulates until it is long again, and nothing tells a contributor which parts apply.

**Keep a generated file tree.** Rejected: an agent derives the tree faster than the generator can be maintained, and the useful half was never the paths.
