# DETAILED_PLAN_REVIEW__PUBLIC — 12-point edge-routing anchors

## Executive Summary
The plan is correct, proportionate, and well-scoped. I empirically validated the two
load-bearing claims against the real libavoid wasm (temporarily applying the 12-pin set and
reverting): the existing facing-side tests stay green, and the new corner-removal test cleanly
discriminates old vs new behaviour. One minor rationale imprecision in §2a was fixed inline.

**Verdict: APPROVE-WITH-MINOR (inline fix done; PLAN_ITERATION can be SKIPPED).**

---

## Verification performed (empirical, not just reasoning)
I applied the plan's exact `BOUNDARY_PIN_SPECS` (and `PIN_EDGE_Q1/Q3` constants) to
`src/view/edgeRouting.ts`, ran the real-wasm block, probed geometries, then **reverted both
source and test files to pristine** (`git checkout` — working tree clean, confirmed).

| Check | Result |
|-------|--------|
| Facing-side tests (horizontal + vertical) with 12 pins | **PASS** (4/4 real-wasm tests green) |
| Diagonal boxes, 12-pin set (offset 200/300/400) | endpoints at quarter pins, `minCornerDistance = 25.0` every time |
| Diagonal boxes, OLD 8-pin set | endpoints exactly on corners, `minCornerDistance = 0.0` |

So the corner-clearance threshold of 12 separates 25 (new) from 0 (old) with a 13px margin —
robust, not flaky, and offset-insensitive.

---

## Critical Issues (BLOCKERS)
None.

## Major Concerns
None.

## Findings against the five review questions

### 1. Is `BOUNDARY_PIN_SPECS` correct? — YES
All 12 entries present; 4 sides × {0.25, 0.5, 0.75}; no both-extreme (corner) entries; every
`dir` is the outward perpendicular of its side (top→`up`@yFrac=0, right→`right`@xFrac=1,
bottom→`down`@yFrac=1, left→`left`@xFrac=0), matching the existing convention (`xFrac` 0=left/1=right,
`yFrac` 0=top/1=bottom). Ordering is cosmetic (libavoid picks cheapest). Type-checks clean.

### 2. Do the existing facing-side tests pass unchanged? — YES (empirically verified), but the plan's *reason* was imprecise
The tests pass. The plan originally justified this by claiming the 0.25/0.75 pins are "strictly
farther from" the straight path, so 0.5 is cheapest. That reasoning is **not accurate**: because
the boxes are cross-axis-aligned, the matched pins line up so the 25→25, 50→50 and 75→75 shots are
all straight and of **equal** length — a genuine 3-way cost tie. The midpoint wins on libavoid's
**tie-break**, not a cost gap. The *conclusion* (endpoint at 50) is correct and I confirmed it on
the real engine, so this is not blocking. I sharpened the §2a wording inline (truthfulness /
POLS) and added an empirical-verification note; the plan already (wisely) makes §2c the durable
regression anchor, so the dependence on tie-break behaviour is low-risk.

### 3. Is the new corner-removal WASM test sound and robust? — YES
Diagonally-offset boxes reliably force a non-midpoint (quarter) pin: measured `minCornerDistance = 25.0`
for offsets 200/300/400. The old 8-pin set lands exactly on corners (`0.0`), so the test is a real
regression guard, not a tautology. `CORNER_CLEARANCE_TOL_PX = 12` sits well below 25 and well above
the 3px border tolerance — clean separation, no flakiness. The `#QUESTION_FOR_HUMAN` about the exact
offset is genuinely non-blocking: every offset I tried yields the same 25px clearance, and the
contract asserted is corner-clearance (not "quarter pin was used"). The `Math.min(...cornersOf())`
spread is safe (array always length 4). One small note below.

### 4. Is the pure spec test well-designed and durable? — YES
12-count, no-corner, all-outward, and per-side {0.25,0.5,0.75}+direction invariants fully lock the
geometry with no wasm dependency. This is the right primary anchor: fast, deterministic, and
independent of libavoid's cost model / tie-break. Exposing the inert `BOUNDARY_PIN_SPECS` (and its
type) for test visibility carries no coupling risk.

### 5. Anything missing / over-engineered / convention-violating? — Minor only
- Docs coverage is adequate and correctly bounded: the three stale "8"/"corner" comment sites
  (`RoutingObstacle.kind` JSDoc ~29–37, the array JSDoc, `registerPinsForShape` JSDoc ~249) are all
  identified; architecture-map and high-level-plan correctly confirmed as no-ops.
- Out-of-scope section (note squares, cost model, clipping, `PinDir`/`visDirsFor` with `"all"`
  retained for the centre pin) is right and preserves the edge-routing__04 perf decision.
- No perf risk revived (group boxes only).

## Simplification Opportunities (PARETO)
None warranted — this is already a ~15-line change with a three-layer test strategy proportionate
to the risk. Do not add more.

## Minor Suggestions (non-blocking; implementer's discretion)
- §2b helpers `cornersOf`/`minCornerDistance` operate on a `RoutingObstacle`. If a similar corner
  helper already exists in `edgeGeometry.ts`, prefer reuse (DRY); otherwise keeping them local to
  the test is fine — they are test-only.
- Consider having the §2b test additionally assert each endpoint lies on exactly one face (the plan
  describes this in prose at lines 127–129 but the two concrete test bodies at 155–158 assert only
  corner-clearance). Corner-clearance alone is the stated contract and is sufficient; the on-face
  assertion is a nice-to-have that would also catch a hypothetical "endpoint drifted off the box"
  regression. Optional.

## Strengths
- Empirically-backed reasoning discipline: §2a explicitly refuses to loosen tolerances if the run
  disagrees, and §6 starts from a failing test.
- Correctly keeps the change surgical and preserves the perf-driven group-only pin decision.
- The pure spec test (§2c) is the right durable anchor, decoupled from libavoid internals.
- Doc-comment updates and CHANGELOG entry are identified with the correct WHY (corner ambiguity).

## Verdict
- [ ] APPROVED
- [x] APPROVED WITH MINOR REVISIONS — inline §2a wording fix applied; **PLAN_ITERATION can be SKIPPED**
- [ ] NEEDS REVISION
- [ ] REJECTED
