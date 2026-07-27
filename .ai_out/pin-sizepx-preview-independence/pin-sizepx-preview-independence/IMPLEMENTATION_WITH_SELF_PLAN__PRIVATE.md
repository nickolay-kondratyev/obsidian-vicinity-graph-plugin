# PRIVATE rehydration notes

Status: **DONE**. Ticket `nid_f8csd65emmy6p62ad9x5w1psz_e` closed. Committed.

## Files changed (test-only)
- `src/engine/NodeSizer.test.ts` — import line widened
  (`NodePreviewPreference`, `ViewSettings` types; `NODE_PREVIEW_PREFERENCES` value)
  + trailing `describe("NodeSizer node preview preference independence")`.
- `src/engine/VicinityEngine.test.ts` — same import widening + trailing
  `describe("VicinityEngine sizing ignores the node preview preference")`.

## Facts verified during work (EXPLORATION_PUBLIC.md was accurate)
- `NODE_PREVIEW_PREFERENCES` is a const tuple (`as const satisfies`), so `[0]`
  type-checks under `noUncheckedIndexedAccess` — no non-null assertion needed.
- `EngineDefaults.viewSettings()` returns a fresh object incl. `sizing`.
- `VicinityEngine.ts:63` is the single sizing call site.
- `NodeSizer.computeSizes` clamps via `clampSizingSettings(rawSettings)`.

## Mutation replay recipe (if a reviewer wants to re-check)
Widen `computeSizes` param to `SizingSettings & { nodePreviewPreference?: string }`,
double `maxPx` when it is `"image"`; and at `VicinityEngine.ts:63` pass
`{ ...viewSettings.sizing, nodePreviewPreference: viewSettings.nodePreviewPreference }`.
`npx vitest run src/engine/NodeSizer.test.ts src/engine/VicinityEngine.test.ts`
→ 2 failed / 52 passed. Revert with `git checkout -- src/engine/NodeSizer.ts src/engine/VicinityEngine.ts`.

## Not done deliberately
- No `graphIdentity.test.ts` guard (no settings in `nodeDimensionsPx` scope → tautology).
- No change_log entry (TOP_LEVEL_AGENT owns it).
- No production behavior change of any kind.
