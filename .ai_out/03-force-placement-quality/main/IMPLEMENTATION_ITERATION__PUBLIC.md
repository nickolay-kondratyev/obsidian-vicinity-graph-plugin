# IMPLEMENTATION ITERATION — Ticket 03 (review-minors pass)

Responds to `IMPLEMENTATION_REVIEW__PUBLIC.md` (verdict APPROVED-WITH-MINORS,
3 MINOR findings). Working tree changes only — top-level agent commits.

## Per-finding disposition

### Minor 1 — padding doc comments overstate the gap: INCORPORATED
The reviewer was right: code applies `paddingPx` once per pair
(`a.halfWidth + b.halfWidth + paddingPx`), but two comments read as per-box
inflation (implying a 2x gap). Fixed the wording in both places; behavior and
values untouched:
- `src/view/forceRectCollide.ts` module doc — now says padding is added
  "ONCE PER PAIR to the combined half-extents ... (not 2x per-box inflation)".
- `src/view/constants.ts` `D3_FORCE_COLLIDE_PADDING_PX` doc — now "Minimum gap
  enforced between each PAIR of boxes ... applied once per pair, not per box".

### Minor 2 — duplicated AABB-overlap test helper: INCORPORATED (partially)
- **Incorporated**: extracted the shared overlap predicate to
  `src/view/testFixtures/aabbOverlap.ts` (`Aabb` + `countOverlappingAabbPairs`,
  strict-inequality semantics documented). Both call sites now delegate:
  - `src/view/D3ForceLayout.test.ts` `overlappingPairCount` maps square
    `Box.side` -> width/height and delegates.
  - `src/view/d3ForceStranding.test.ts` `overlappingRootPairCount` keeps its
    layout-extraction (that part is suite-specific) and delegates the counting.
  The AABB-overlap predicate is genuine knowledge duplication (DRY), and the
  reviewer predicted a third layout-quality suite; extraction cost was trivial.
- **Rejected (sub-item)**: sharing `HUB_SIZE_PX`/`NEIGHBOR_SIZE_PX` across the
  two test files. Rationale: those are per-fixture test DATA that happen to be
  equal (160/80), not shared knowledge — the stranding fixture mirrors a
  specific vault topology and must stay free to change its sizes without
  touching the hub fan-out suite. Coupling them would trade fake DRY for real
  test interdependence (KISS/robust-tests).

### Minor 3 — public-vault visual AC deferred to human smoke run: NO ACTION (by design)
Informational finding carrying a `#QUESTION_FOR_HUMAN` addressed to the human
(does the dev-vault mirror + metric test satisfy the public-vault visual AC?).
Not mine to resolve; left intact in `IMPLEMENTATION_REVIEW__PUBLIC.md` for the
top-level agent to surface. No code change is possible or appropriate here.

## Verification

| Check | Result |
|---|---|
| `npm test` (`.tmp/iter-test.log`) | **703/703 pass**, 58 files, exit 0 |
| `npm run check` (`.tmp/iter-check.log`) | exit 0 (strict tsc clean) |

Files touched this pass: `src/view/forceRectCollide.ts` (comment),
`src/view/constants.ts` (comment), `src/view/testFixtures/aabbOverlap.ts`
(new), `src/view/D3ForceLayout.test.ts`, `src/view/d3ForceStranding.test.ts`
(both: delegate to shared helper; assertions unchanged). No production
behavior changed; no test weakened.

## Readiness

**READY** — all review findings dispositioned; suites green; only the Minor-3
`#QUESTION_FOR_HUMAN` remains open for the human.
