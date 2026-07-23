# IMPLEMENTATION_WITH_SELF_PLAN — PRIVATE memory (edge-routing__04)

## Goal
Phase A (boundary pins) + Phase B (detour telemetry). Phase C OUT.

## Plan / checklist — ALL DONE
1. [x] libavoidLoader.ts: added typed `ConnDirUp/Down/Left/Right: number` to `Avoid`.
2. [x] edgeRouting.ts: 8 same-class boundary pins via immutable `BOUNDARY_PIN_SPECS`
   + `visDirsFor(avoid, dir)` resolver. `PIN_CLASS`, `PIN_EDGE_MIN/MID/MAX`,
   `PIN_INSIDE_OFFSET=0`. ConnEnd wiring unchanged. Class + route() doc updated.
3. [x] edgeGeometry.ts: pure `detourRatio(points)` + `DETOUR_RATIO_DEGENERATE=1`.
4. [x] edgeGeometry.test.ts: 4 BDD tests (straight=1, detour>1, straight-through=1, zero-chord).
5. [x] GraphViewController.ts: `detourStats` helper + `EMPTY_DETOUR_STATS`; debug object
   now logs maxDetourRatio/meanDetourRatio over clipped routes (log moved after clip+isStale).
6. [x] npm test 662 passed / 54 files; npm run check green. Real-wasm block ran (not skipped).

## Result: shipped 8-pins-ALL-shapes (primary path). No group-only fallback, no `kind` threading.

## Pin-spec design
- 8 pins/shape, all PIN_CLASS=1. Side midpoints face outward (visDirs), corners ConnDirAll.
- Table `BOUNDARY_PIN_SPECS: {xFrac,yFrac,dir}` with dir token `"up"|"down"|"left"|"right"|"all"`,
  resolved to `avoid.ConnDir*` at loop time (avoid instance only available in route()).
- insideOffset 0, proportional true.

## Decisions
- Shipping 8-pins-ALL-shapes (ticket primary path). NOT threading `kind` / group-only fallback —
  no perf evidence to downgrade; perf can't be measured under vitest (wasm virtual module
  esbuild-only). Perf gate must be verified by TOP_LEVEL in dev vault.
- Debug log moved AFTER clip + isStale check (metrics need clipped routes). Minor behavior change:
  a stale pass no longer logs its duration (was logging before). Acceptable — discarded work.
- detour degenerate value = 1 (neutral "no detour"), documented, never NaN/Infinity.

## Files
- src/view/libavoidLoader.ts
- src/view/edgeRouting.ts
- src/view/edgeGeometry.ts (+ .test.ts)
- src/view/GraphViewController.ts

## Iteration 2 — reviewer SHOULD-FIX (facing-side regression guard) — DONE
- Added 2 BDD tests in `LibavoidEdgeRouter with real wasm` (edgeRouting.test.ts):
  horizontal (right→left border) + vertical (bottom→top border) facing-side attachment.
- Reuse existing real-wasm harness (`loadAvoidMock`, `if (!loaded) return;` guard).
  Both EXECUTED (not skipped) — sibling bends-around test ran 6ms confirming wasm loaded.
- Assert endpoints on FACING border within 3px + mid-span within 10px. Would FAIL for
  centre pins (endpoint at 50/350) or inverted visDirs (detour). Only test file touched.
- `npm test`: 664 passed / 54 files (was 662, +2). `npm run check`: green.

## Open risks
- PERF GATE unverified in-agent (wasm not under vitest). TOP_LEVEL must confirm dense-fixture
  routing pass stays well under layout with 8 pins × ~100 obstacles.
