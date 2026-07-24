# PLAN_REVIEWER — private rehydration memory (`edge-routing__05`)

## State
DETAILED_PLAN_REVIEW__PUBLIC.md written. Verdict **NEEDS_ITERATION**. 5 minor fixes applied inline
to DETAILED_PLANNING__PUBLIC.md. 2 `#QUESTION_FOR_HUMAN` raised (D1 bar vs 1.25 ratio; 2a/2b split).

## What I actually verified (do not redo)
`node_modules/` IS installed in this checkout — probes run directly, no `npm ci` needed.
Re-ran probe3/5/6/8/9/10: **every number reproduces exactly**. The negative result (facing pin costs
= 0 of 818, still 0 at cost 100 000) is trustworthy; methodology is clean (cost set on the
constructed pin before `processTransaction`, positive control shares the call path).

## My own probes (kept in `.tmp/`, re-runnable)
- `.tmp/probe11-reviewer.mjs` — isolates variants A=today, B=sharedClass+setExclusive(false),
  C=sideClass+setExclusive(false), KB=keep-better(B,C)@1.25. Two corpora (1–3 and 1–7 edges/group).
  **Key result (higher degree, 1668 edges): A=82, B=40, C=2, KB=13 non-facing.** B is one line.
- `.tmp/probe12-reviewer.mjs` — bend-aware selection metric (`len + 50*bends`) vs length-only:
  disagrees on 2/802 and 9/1668, marginally worse. **Length-only is correct; do not re-litigate.**
- `.tmp/probe13-reviewer.mjs` — ratio sweep vs the HONEST baseline. ratio 1.0 → 22 non-facing,
  0 edges longer than baseline; 1.25 → 13 non-facing, 54 edges longer, worst 1.25x.

## The five findings that drive the verdict
- **M1** probe8/9 never call `setExclusive(false)` and use a NON-total facing rule that falls back to
  class SHARED on overlap → group has no class-1 pins → centre fallback (the
  `assignPinVisibilityTo` warnings in the output). Measured config ≠ shipped config. Re-measure.
- **M2** `setExclusive(false)` alone = 61% of the win for ~1 line → demand a 2a/2b phase split.
- **M3** 1.25x structurally conflicts with D1's "medium holds at 1.000" (detourRatio can only rise
  when you accept longer routes). Needs a human call; ratio 1.0 is the constant-free alternative but
  may not fix Epictetus (a wrap wins exactly when the facing route is longer).
- **M4** "dense untouched" is a fixture artifact — groupByFolder is default, no grouped-dense fixture
  exists. Two passes cost ~2x (386ms vs 372ms in my runs); still inside budget, but measure it.
- **M5** Phase 1 fixture cannot fail (force layout decides) — plan admits it; reframe as smoke, not
  regression guard.

## Checks that came back CLEAN (do not re-check)
Pin lifetime / no double-free (§3.4 correct). E8 enforced structurally by the `mode` param. Route
cache sound (kind not in signature but id→kind is a function: folder paths vs vault paths).
`durationMs` at `GraphViewController.ts:261-263` wraps `edgeRouter.route()` so both passes are
timed honestly. `needsFacingPass` genuinely false on dense. **Nowhere does the plan permit loosening
FACING_BORDER_TOL_PX / MID_SPAN_TOL_PX / CORNER_CLEARANCE_TOL_PX — it forbids it twice.**
Phase 0 staleness claims all verified in `e2e/edgeRoutingEval.e2e.ts` (lines 31, 180, 298 of
obsidianHarness) and `write_if_missing` in `scripts/setup-dev-vault.sh:22`.

## Inline edits I made to DETAILED_PLANNING__PUBLIC.md
1. §3.2 `chooseRoutes` — degenerate facing route (<2 pts) must not be eligible (+ §6.1 test bullet).
2. §0 E9 — corrected ">12 edges" to "≥4 edges approaching one side" (probe10: 5 of 8 hit centre).
3. §3 — subset-routing soundness invariant (only valid while crossingPenalty=0 AND pins non-exclusive).
4. §3.2 — recorded the bend-metric measurement so it is not re-litigated.
5. §3.2 rule 3 — the diagonal corner-clearance test is an EXACT tie, so the tie-break is live there.

## If asked to re-review after PLAN_ITERATION
Check only: (a) numbers re-measured with setExclusive(false) + total facingSideOf; (b) 2a/2b split
present; (c) D1 bar resolved per human answer; (d) a grouped-dense measurement exists.
