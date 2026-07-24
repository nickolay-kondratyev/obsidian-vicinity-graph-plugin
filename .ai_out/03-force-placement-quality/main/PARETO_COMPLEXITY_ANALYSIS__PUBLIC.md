# PARETO_COMPLEXITY_ANALYSIS — Ticket 03 (AABB rect-collide stranding fix)

Date: 2026-07-23. Scope reviewed: commits `507a27a` (feat), `0287bdd` (review docs),
`cc47369` (iteration refactor). Inputs: `RE_PLAN__PUBLIC.md`, `IMPLEMENTATION__PUBLIC.md`,
`IMPLEMENTATION_REVIEW__PUBLIC.md` verdict, and the shipped source itself.

## Pareto Assessment: PROCEED (JUSTIFIED)

**Value Delivered:** Fixes a visible, core-UX defect in the plugin's primary surface
(force layout): linked leaves stranded off tall folder-group containers with long
crossing edges. Boundary gap 207px → 33px on the vault-mirror fixture, deterministic,
zero new configuration, prototype-validated before implementation.

**Complexity Cost:** ~75 LOC new production module (`src/view/forceRectCollide.ts`)
plus a net *simplification* of `src/view/d3ForceRefinement.ts` (the `collideRadius`
field and circumscribed-circle indirection were deleted; `ForceBody` now just extends
`RectCollideBody`). Test surface: 7 unit tests + 2 integration tests + one 27-line
shared helper. No new settings, no new seams, no cross-module cascade.

**Ratio:** High.

## Evidence per criterion

### 1. Value/complexity ratio — HIGH
- The production diff is small and partly *negative* in complexity: the old code
  carried a per-body `collideRadius` (circumscribed circle + padding) precisely to
  fake box separation with circles; the new force models the boxes directly, which
  is the more honest abstraction, not a fancier one.
- `forceRectCollide` has exactly two parameters (padding, iterations), both wired to
  pre-existing constants whose **values are unchanged**. Zero configuration surface
  added — configuration complexity ≪ use-case diversity, the right side of that line.
- Cheaper alternatives were not skipped blindly: options 2/3 (attract-to-member,
  squarer containers) were rejected on empirical grounds (the circular collide floor
  alone forbids closeness), so the custom force IS the minimal fix, not gold-plating.

### 2. Scope creep — NONE DETECTED
- Everything shipped traces to the RE_PLAN's 7 steps. The dev-vault repro cluster
  (42 lines in `scripts/setup-dev-vault.sh`) is self-contained and directly serves
  reproducibility of THIS bug — acceptable QA scaffolding, not adjacent-problem work.
- The iteration commit (`cc47369`) *reduced* code: it extracted a duplicated
  AABB-overlap predicate used by two test files into
  `src/view/testFixtures/aabbOverlap.ts` (DRY, −13 lines in each caller).

### 3. Premature abstraction — NONE
- `RectCollideBody` is the one interface the force needs; no speculative generics,
  no strategy pattern, no plugin points. The force is a plain d3 `Force` — the
  idiomatic extension seam d3 itself defines (OCP via the existing contract).
- The seemingly "extra" mechanics (anticipated positions `x+vx`, deterministic
  tie-break, fixed pair order) are not generality — they mirror d3's own
  `forceCollide` semantics and are load-bearing for the repo's bit-identical
  determinism contract. Each has a WHY comment.

### 4. YAGNI boundaries — RESPECTED, EXPLICITLY
- **Quadtree deferred**: O(n²) shipped with a quantified WHY comment (root children
  only, ~300 static ticks, ≪10ms). Correct call.
- **Rect-aware directional link force deferred**: RE_PLAN documents the known
  spring-vs-collide tension and says "do NOT build pre-emptively"; the shipped code
  uses a scalar `minHalfExtent` distance. Correct call — collide wins, zero overlaps
  observed.
- **High-crowd second-ring overflow NOT asserted**: the caveat (crowd ≥ 10 worst gap
  can exceed baseline) is documented as geometry, not chased with more machinery.

### 5. Test surface — PROPORTIONATE, NOT EXCESSIVE
- 7 unit tests, each one behavior, each guarding a real invariant (min-axis choice,
  padding-as-pair-gap, tie-break determinism, anticipated positions, iteration
  idempotence). For a physics kernel whose failure mode is silent visual jank,
  this is the cheap 20% that buys 80% of the regression safety.
- The integration test asserts ONE threshold (`≤ 100px`) on the crowd=5 vault
  mirror with a 3x margin each way and a WHY block — robust against benign tuning,
  loud on regression. It deliberately does NOT over-assert on high fan-out fixtures.

## Under-engineering check (what could bite)

Nothing rises to a required change. Two watch items, neither actionable now:

1. **Empirical threshold constant** (`D3_FORCE_MAX_BOUNDARY_GAP_PX = 100` in the
   test): if force constants are ever retuned wholesale, this may need re-derivation.
   The WHY comment already explains how to re-derive it (midpoint of broken/fixed
   measurements). Acceptable.
2. **`boundaryGapPx` projection math** in `d3ForceStranding.test.ts` is the subtlest
   code in the change (~20 lines of ray-vs-AABB extent). It is commented and
   test-only; if a second suite ever needs it, extract next to `aabbOverlap.ts`
   then — not now (single caller, extraction today would be speculative DRY).

## Follow-up ticket suggestions

- **None new.** The two natural follow-ups already exist as tickets/documented
  deferrals: the pre-existing e2e reds are ticketed
  (`docs-internal/tickets/ticket-e2e-gamma-breadcrumb-fails-headless.md` + the
  radial-leftovers ticket), and the rect-aware link force / high-crowd behavior is
  an explicitly conditional deferral in RE_PLAN (trigger: visual QA observation,
  covered by the human smoke-run ticket). Filing a ticket for it now would itself
  be a YAGNI violation.

**Recommendation:** Proceed as-is. No simplifications worth their churn; the change
is at or below the minimum complexity that actually fixes the root cause.
