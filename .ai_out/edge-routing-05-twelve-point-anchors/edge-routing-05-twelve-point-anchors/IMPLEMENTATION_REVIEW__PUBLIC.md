# IMPLEMENTATION_REVIEW__PUBLIC — 12-point edge-routing anchors

## Verdict: APPROVE-WITH-MINOR

The implementation exactly meets the confirmed requirements. One MINOR stale-comment
follow-up (non-blocking). No blocking issues. Safe to merge; the minor can be folded in
opportunistically.

## Re-run verification (this reviewer, at HEAD = 2be57fa)

- `npm run check` (tsc strict) — **EXIT 0**, no errors.
- `npm test` (vitest) — **EXIT 0**: `Test Files 55 passed (55) · Tests 681 passed (681)`.
  Confirms the implementer's 681/681 claim.
- Verbose `edgeRouting.test.ts` run confirms the real-WASM block **actually executed**
  (facing 2ms/1ms, diagonal-corner 1ms/1ms — not the `if (!loaded) return` 0ms skip path).
  The corner-clearance guarantee is proven end-to-end, not silently skipped.

## Correctness — PASS

`BOUNDARY_PIN_SPECS` is exactly 12 side-only outward-perpendicular pins, no corners:

- Top (`yFrac=0`, `dir:"up"`): xFrac ∈ {0.25, 0.5, 0.75} ✓
- Right (`xFrac=1`, `dir:"right"`): yFrac ∈ {0.25, 0.5, 0.75} ✓
- Bottom (`yFrac=1`, `dir:"down"`): xFrac ∈ {0.25, 0.5, 0.75} ✓
- Left (`xFrac=0`, `dir:"left"`): yFrac ∈ {0.25, 0.5, 0.75} ✓

No off-by-one in fractions; every `dir` matches the side's outward perpendicular; no
`"all"`/corner entries remain. `PIN_EDGE_Q1 = 0.25` / `PIN_EDGE_Q3 = 0.75` added beside the
existing MIN/MID/MAX constants — no magic numbers. `CENTRE_PIN_SPEC`, the note-square branch
in `registerPinsForShape`, `visDirsFor` (keeps `"all"` for the centre pin), and the cost model
are UNTOUCHED (verified via diff). Group-only scope preserved — the edge-routing__04 perf
decision is not revived.

## Test quality — PASS (robust, non-tautological)

- **Pure spec-lock** (`describe("BOUNDARY_PIN_SPECS")`): asserts count=12, no corner
  (both fracs extreme), no `"all"` dir, and per-side fracs sort to exactly `[0.25,0.5,0.75]`
  with dir = outward perpendicular. This locks the full face geometry independent of libavoid's
  tie-break — the durable regression anchor.
- **Real-WASM corner-clearance**: two diagonally-offset group boxes; asserts each endpoint's
  min distance to any box corner > 12px. A side-only pin sits ≥25px from the nearest corner, the
  old corner pins sat at 0px — `CORNER_CLEARANCE_TOL_PX = 12` cleanly separates the two regimes,
  so the test is not flaky and genuinely captures the corner-removal guarantee. It exercises real
  routing (confirmed non-zero timing above), so it is not tautological.
- **No assertion weakening (no lie):** the existing facing-side tests (`FACING_BORDER_TOL_PX=3`,
  `MID_SPAN_TOL_PX=10`) are byte-for-byte unchanged vs HEAD~1 — the diff only *adds* code after
  them. Despite the CLARIFICATION's warning that 12 pins might shift the endpoint to a 1/4 or 3/4
  pin, libavoid still selects the midpoint pin for the perfectly-facing boxes, so those tests stay
  green without loosening. Verified by diff.

## Conventions / scope — PASS

- BDD `WHEN…THEN…`, one behavior per test, colocated. Named constants throughout.
- View-layer only; no engine/shared import-guard concern. `BOUNDARY_PIN_SPECS` +
  `BoundaryPinSpec` exported for the pure test — inert data, acceptable.
- No `ap_XXX_E` anchors touched (none in the diff). No behavior-capturing tests removed.
- `main.js` / `styles.css` build artifacts not hand-edited.
- CHANGELOG entry is succinct, correctly placed at the top under the edge-routing lineage,
  and accurately notes group-only scope + no cost-model change.
- Nothing over-engineered; the optional §2b "on-face" extra assertion was reasonably skipped
  (PARETO) since the pure spec test already locks face geometry.

## Findings

### MINOR-1 (non-blocking) — one stale "8 pins" comment survived

`src/view/edgeRouting.ts:33`, inside the `RoutingObstacle.kind` JSDoc:

> `* pin (the pre-edge-routing__04 behaviour) — 8 pins × the many ungrouped spokes of`

The implementer fixed the `"the 8 boundary pins"` phrase on line 31 of the same block but
missed this second `"8 pins ×"` two lines down. Group boxes now register 12 pins, so the
perf-rationale number is stale (the argument itself still holds — 12 pins is even heavier than
8, so the WHY-not-on-note-squares reasoning is unchanged). Suggest degeneralising to "many pins ×"
to match how the `BOUNDARY_PIN_SPECS` block comment was already reworded. Documentation-only;
no behavior impact.

## Documentation updates needed

None beyond MINOR-1 above. `architecture-map.md` and `high-level-plan.md` are correctly no-ops
(no structural or behavioral-contract change).
