# 1. Hex grid coordinate conventions

Date: 2026-08-25

## Status

Accepted

## Context

A position on the hex map was spelled seven different ways across the codebase:

- `HexCoordinates { col, row }` in `types/canvas.ts`, the output of `pixelToHex`
- `TileCoords { x, y }` in the same file
- `x` and `y` integer columns on `revealedTiles`, `navigationPaths` and `mapMarkers`
- `Hex.id`, a `"col-row"` string built inline in `MapCanvasWrapper`
- the tile key, the same `"col-row"` string built by `hexToTileKey()`
- `isAdjacentHex(fromX, fromY, toX, toY)` on the server, four positional numbers named x and y but holding col and row values
- axial `q`/`r`, computed inline in `MapView` for brush distance

Three consequences followed from that.

`TileCoords` and `PixelPoint` were both `{ x: number; y: number }`. TypeScript is structural, so a pixel point passed as a tile coordinate, in either direction, without a compile error.

`tileKeyToHex` split on `-` and parsed each half, so `"01-5"` and `"1-5"` denoted the same hex but were distinct strings. Since revealed tiles are held in a `SvelteSet<string>` keyed by these, two spellings of one hex could occupy two entries.

The grid dimensions are named `hexesPerRow` and `hexesPerCol`, where `hexesPerRow` means "hexes in one row" and is therefore the _column_ count. That inversion produced two separate comments invoking a 90 degree rotation to explain correct code, at `MapView.svelte:270` and `MapCanvas.svelte:136`. Neither is flipping anything. Both sites compute the right values. A contributor who "corrects" the apparent inconsistency breaks both, and nothing tests them.

## Decision

**`{ col, row }` is the canonical in-memory position.** `TileCoords` is retired. `x` and `y` survive only as database column names, mapped to `col` and `row` Drizzle field names so that nothing outside `schema.ts` sees them. No migration: the columns keep their names.

**The tile key is a branded type with one owner.** `hexToTileKey()` is the only way to mint a `TileKey`, `tileKeyToHex()` the only way to read one, and it rejects any string that does not round-trip exactly, which removes the leading-zero aliasing. Inline construction and `split('-')` parsing are gone from `MapCanvasWrapper`, `MapView` and everywhere else. The key is a Map and Set key, never the thing arithmetic is done on.

**Axial coordinates are sealed.** The shared hex module exposes `areAdjacent`, `hexDistance` and `hexesWithin`, all taking `{ col, row }`. `q` and `r` exist only as locals inside those functions. No caller holds an axial pair.

**Adjacency takes two objects.** `areAdjacent(from: HexCoordinates, to: HexCoordinates)` replaces the four positional numbers, so a transposed argument cannot pass unnoticed.

**Grid dimensions are `columnCount` and `rowCount`.** The database columns `hexes_per_row` and `hexes_per_col` keep their names; the Drizzle fields and all application code do not.

**`Hex` carries `key: TileKey`,** not `id: string`.

## Consequences

The odd-q offset table and the axial conversion exist once, in `$lib/utils/hex.ts`, importable by both server and client, and under test. Today the server's adjacency and the frontend's distance implement the same convention independently, and a change to rotation or offset on one side diverges silently from the other.

Both rotation comments delete themselves. `hex.col === columnCount - 1` needs no explanation, so the trap for a future refactor closes.

This is a wide refactor: 23 files reference `.x`. It lands expand-contract: the module and types first, then one migrate batch per surface (server and schema, stores, canvas and dialogs), then deletion of the old spellings. The server and schema batch is atomic rather than gradual, because a Drizzle table has one field name per column: the moment `schema.ts` changes, every query referencing `.x` breaks.

The migrate batches wait for `fix/realtime-sync` to land. That branch already rewrites `movement/player`, `markers`, `tiles/batch` and all four store files, so migrating those surfaces first means resolving the same conflicts twice.

`CODE_GUIDE.md` documents the current convention and is superseded by this ADR where the two disagree. It lives in `.dev_docs/` and is not in the repository, so this file is the only version a contributor can read.

## Alternatives considered

**`{ x, y }` as canonical**, matching the database. Rejected: it collides structurally with `PixelPoint`, which is the mix-up the type system should be catching.

**Renaming the database columns** to `col` and `row`. Rejected: a migration across three tables to fix a naming problem that a Drizzle field alias solves at no risk.

**Axial as a public coordinate type**, with `toAxial` and `axialDistance` exported. Rejected: it adds a fifth public spelling of "where" to a codebase whose problem is that it has too many, and the two operations actually needed are expressible in `{ col, row }`. If pathfinding later needs axial directly, it can be opened up from a module that already owns the conversion and its tests.

**Branding every coordinate pair**, not just the key. Rejected as more ceremony than this codebase needs: distinct field names, `col`/`row` against `x`/`y`, already separate tile space from pixel space.
