# PRIVATE rehydration notes

Status: **DONE** (impl + review follow-ups S1/S2). Test-only throughout.
See `IMPLEMENTATION_ITERATION__PUBLIC.md` for the iteration record.

## Files changed (test-only)
Round 1 (commit `16bed89`):
- `src/engine/NodeSizer.test.ts` — import widened (`NodePreviewPreference`,
  `ViewSettings`, `NODE_PREVIEW_PREFERENCES`) + trailing
  `describe("NodeSizer node preview preference independence")`.
- `src/engine/VicinityEngine.test.ts` — same widening + trailing
  `describe("VicinityEngine sizing ignores the node preview preference")`.

Round 2 (this iteration):
- `src/view/GraphStructureDiff.test.ts` — S1: pointer comment now names the
  three guards instead of saying the work is outstanding.
- `src/view/flowMapping.test.ts` — S2: import widened + trailing
  `describe("vicinityGraphToFlow node geometry ignores the node preview preference")`.

## Facts verified during work
- `NODE_PREVIEW_PREFERENCES` is a const tuple, so `[0]` type-checks under
  `noUncheckedIndexedAccess` — no non-null assertion needed.
- `VicinityEngine.ts:63` is the single sizing call site.
- `vicinityGraphToFlow` sets note width/height at `flowMapping.ts:186-198` via
  `nodeDimensionsPx(node)`; `nodePreviewPreference` enters only through
  `toFlowNodeData` → `nodePreviewKind` (`:322`). That adjacency is the S2 risk.

## Mutation replay recipes
- Engine: widen `computeSizes` param to `SizingSettings & { nodePreviewPreference?: string }`,
  double `maxPx` for `"image"`, and pass the preference at `VicinityEngine.ts:63`.
- View (S2): in `flowMapping.ts` `noteNodes` map, emit
  `height + 30` when `graph.viewSettings.nodePreviewPreference === "image"`
  → `npx vitest run src/view/flowMapping.test.ts` = 1 failed / 62 passed.
  Revert: `git checkout -- src/view/flowMapping.ts`.

## Not done deliberately
- No `graphIdentity.test.ts` guard (`nodeDimensionsPx` takes no settings → tautology).
- NITs N1 (self-comparing baseline) and N2 (extract the shared idiom) REJECTED —
  rationale in `IMPLEMENTATION_ITERATION__PUBLIC.md`.
- No change_log entry, no merge, no ticket state change (TOP_LEVEL_AGENT owns them).
- No production behavior change of any kind.
