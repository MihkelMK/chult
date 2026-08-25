# 4. No layer caching for frequently-changing layers

Date: 2026-08-25

## Status

Accepted

## Decision

Konva layer caching is not used for the revealed-tiles layer or the selected-tiles layer. Both change often enough that caching costs more than it saves.

Caching remains appropriate for content that does not change: the background map image. The fog layer sits between the two and depends on how often fog changes in a given campaign; it is not cached today.

## Context

Layer caching was tried and removed. The implementation attached a cache on an effect and cleared it on teardown:

```typescript
$effect(() => {
  if (revealedLayerRef) revealedLayerRef.cache();
  return () => revealedLayerRef?.clearCache();
});
```

For a layer that changes, each update becomes clear, re-render, rebuild cache: three operations where drawing directly is one. Revealing tiles is the most common interaction in the application, so the layer that caching was most tempting for is the one it hurt most. Selection thrashes the cache in the same way, once per selection change.

This is recorded as a decision rather than dropped because the reasoning is not visible from the code. What a reader sees now is a render path with no caching on a canvas library that offers it, which looks like an oversight rather than a conclusion.

## Consequences

Every reveal and every selection change re-renders its layer directly. That is the cheaper path for these layers, and it is why no `.cache()` call exists in the canvas components.

The optimisations that did help are applied instead and should stay: `perfectDrawEnabled={false}`, `shadowForStrokeEnabled={false}`, and computing styles at render time rather than ahead of it.

The comparison behind this decision was made by hand during one optimisation pass and has not been re-measured. It should not be cited as a benchmark. If #117 finds that layer composition is the dominant cost in zoom and pan, this decision is worth revisiting with real numbers, and specifically for the fog layer, which is the one case here that was never settled either way.

## Alternatives considered

**Cache every layer.** Rejected: this is what was tried, and it made reveals slower.

**Cache the fog layer only.** Not rejected, and left open. Fog changes far less often than revealed tiles in most campaigns, which is the condition under which caching pays. Nobody has measured it.

**Cache and invalidate selectively**, rebuilding only on a subset of changes. Rejected as more machinery than the measured problem justified. It is the kind of complexity that needs a profile behind it, which is what #117 is for.
