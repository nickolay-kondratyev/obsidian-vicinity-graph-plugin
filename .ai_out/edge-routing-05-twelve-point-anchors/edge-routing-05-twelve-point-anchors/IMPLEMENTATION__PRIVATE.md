# IMPLEMENTATION__PRIVATE — 12-point edge-routing anchors (rehydration memory)

## Outcome
Fully implemented per DETAILED_PLANNING__PUBLIC.md. check PASS, test 681/681 PASS. No hacks,
no deviations, no escalations.

## Exact edits (for re-verification / rollback)
`src/view/edgeRouting.ts`:
- Constant block (~L176): added `PIN_EDGE_Q1 = 0.25`, `PIN_EDGE_Q3 = 0.75`; rewrote doc.
- `BOUNDARY_PIN_SPECS` (~L196): now `export const`, 12 side-only entries (clockwise-ish order,
  order is cosmetic — libavoid picks cheapest). Doc comment rewritten (12 pins, WHY-no-corners).
- `BoundaryPinSpec` interface: now `export interface`.
- `RoutingObstacle.kind` JSDoc: "the 8 boundary pins" → "the boundary pins".
- `registerPinsForShape` JSDoc: "the 8 {@link…}" → "the {@link…}". NOTE: this line had a
  leading-tab match quirk — the first Edit failed on the full 2-line block; succeeded matching
  just the `get the 8 {@link BOUNDARY_PIN_SPECS} (facing-side` fragment.

`src/view/edgeRouting.test.ts`:
- Imports: added `BOUNDARY_PIN_SPECS` value import + `BoundaryPinSpec` type import.
- New `describe("BOUNDARY_PIN_SPECS")` before the real-wasm describe. Uses `sidePinOf` to map a
  spec → {side, along-fraction}: xFrac===0→left, xFrac===1→right, yFrac===0→top, else bottom.
  `OUTWARD_DIR` record maps side→expected dir. Per-side {0.25,0.5,0.75} multiset check via sort.
- Real-wasm block: added `CORNER_CLEARANCE_TOL_PX=12`, `cornersOf`, `minCornerDistance` after
  `isStrictlyInside`; two diagonal-offset tests reusing `routePair(boxL,boxR)` with
  boxL{0,0,100,100}, boxR{300,300,100,100}, kind:"folder-group".

`docs-internal/CHANGELOG.md`: new top entry (dated 2026-07-23) above the node-width entry.

## Key facts confirmed
- Reviewer empirically validated: 12-pin diagonal → minCornerDistance=25 (new) vs 0 (old);
  tol=12 separates cleanly. Facing-side tests green on tie-break (aligned boxes → equal-length
  25/50/75 shots, libavoid tie-breaks to midpoint). Did NOT loosen MID_SPAN_TOL_PX(10) or
  FACING_BORDER_TOL_PX(3) — both stayed green.
- Real-wasm block DID load in this env (facing+diagonal tests ran at 1ms with real assertions,
  not the skip path). If a future env can't load node libavoid-js, those tests `return` early
  (documented skip); the pure §2c spec test is the env-independent regression anchor.

## Not touched (out of scope, verified)
CENTRE_PIN_SPEC, registerPinsForShape note branch, visDirsFor ("all" kept for centre pin),
cost model (buffer/segment/crossing penalties), clipping geometry, GraphViewController,
edgeGeometry, main.js/styles.css (build not run). No new ticket (change fully resolves request).

## Commands
`npm run check > .tmp/impl-check.log 2>&1` → EXIT 0
`npm test > .tmp/impl-test.log 2>&1` → EXIT 0, 55 files / 681 tests
`npx vitest run src/view/edgeRouting.test.ts --reporter=verbose` → all edgeRouting tests ✓
