# 3. No viewport culling of fog for players

Date: 2026-08-25

## Status

Accepted

## Decision

The player view renders every unrevealed tile. Viewport culling must never be applied to fog-of-war in the player view.

The DM view is unconstrained: culling there is a rendering optimisation with no gameplay consequence, because the DM is permitted to see the whole map.

Note that no culling exists in the codebase today, for either role. This decision governs what may be added, not what must be removed.

## Context

Fog-of-war is the only thing standing between a player and the parts of the map they have not explored. If the set of rendered fog hexes is derived from the viewport, then the fog a player can see is a function of where they have panned. Panning quickly, or faster than the derived set can keep up, opens gaps through which unrevealed terrain shows.

That makes culling a gameplay integrity problem in the player view, not a performance decision. A player who wants to see the map ahead of the party does not need to modify the client; they need to scroll.

The temptation is real and recurring, because rendering every unrevealed hex looks straightforwardly wasteful. The codebase's earlier guide recorded roughly 6,192 shapes on a full grid. Anyone reading the render path will notice this and reach for culling as the obvious fix.

## Consequences

The player view carries the full cost of drawing every unrevealed hex, at every zoom level, on every device a player uses. That cost is accepted for gameplay integrity.

It is a real cost and it is not currently measured. The previous guide claimed Konva handles that shape count in under 5ms, but issues #117 and #120 exist because scroll zoom and pan are not performant, so that figure should be treated as unverified rather than as a baseline. When #117 profiles the render path, it may find this decision is a significant part of the cost. That does not reopen the decision; it means the saving has to come from somewhere else.

Cheaper optimisations that do not affect which hexes are drawn remain available and are already applied: `perfectDrawEnabled={false}` and `shadowForStrokeEnabled={false}` on the Konva shapes, and computing styles at render time rather than ahead of it.

A reviewer seeing a diff that derives any player-visible fog set from viewport bounds should treat it as a security change, not a performance one.

## Alternatives considered

**Cull for both roles.** Rejected: it is the exploit described above.

**Cull for the DM only.** Not rejected, and permitted by this decision, but not currently implemented. It buys nothing today because the DM view is not where the reported performance problem is.

**Cull with a generous margin around the viewport**, so gaps cannot appear during normal panning. Rejected: it converts a hard guarantee into a tuning parameter, and the failure mode is silent. Nobody notices a margin is too small until a player mentions seeing something.
