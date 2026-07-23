# IMPLEMENTATION_REVIEWER__PRIVATE — memory

## Commit reviewed
2be57fa "feat(edge-routing-05): 12-point side-only boundary anchors (drop corners)"

## Verdict: APPROVE-WITH-MINOR

## What I verified (fresh eyes)
- Diff of `src/view/edgeRouting.ts`, `edgeRouting.test.ts`, `CHANGELOG.md` vs HEAD~1.
- `BOUNDARY_PIN_SPECS`: 12 entries, 3 per side at 0.25/0.5/0.75, all outward-perpendicular
  dir matches side, zero corners, zero `"all"`. Directions all correct. No off-by-one.
- Constants `PIN_EDGE_Q1=0.25`, `PIN_EDGE_Q3=0.75` added; no magic numbers.
- `CENTRE_PIN_SPEC`, note-square branch, `visDirsFor`, cost model UNTOUCHED (group-only scope
  intact; perf decision from edge-routing__04 not revived).
- Pure spec-lock test: robust, locks full geometry, not tautological.
- Real-WASM corner-clearance test: ran for real (verbose timing 1ms, not 0ms skip), 25px vs
  12px tolerance → not flaky, genuinely captures corner removal.
- Facing-side tests (`FACING_BORDER_TOL_PX=3`, `MID_SPAN_TOL_PX=10`) unchanged vs HEAD~1 — no
  weakening/lie. libavoid still picks midpoint pin for perfectly-facing boxes so they stay green.
- Re-ran: `npm run check` EXIT 0; `npm test` EXIT 0 → 681/681 (55 files). Matches claim.

## Only finding (MINOR, non-blocking)
- `edgeRouting.ts:33` JSDoc still says "8 pins × the many ungrouped spokes" — stale count
  (now 12). Implementer fixed line 31's "8 boundary pins" but missed this sibling on line 33.
  WHY-not rationale still valid (12 pins even heavier). Doc-only.

## Notes for future
- The `if (!loaded) return` wasm-skip pattern is a documented pre-existing convention; here it
  did NOT trigger (wasm loaded), so no silent-pass concern this round. Worth spot-checking timing
  in verbose output each review to be sure the guarantee actually ran.
