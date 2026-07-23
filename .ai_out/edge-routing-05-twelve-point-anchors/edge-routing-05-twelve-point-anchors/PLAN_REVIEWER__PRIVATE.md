# PLAN_REVIEWER__PRIVATE — 12-point anchors

## What I did
Applied the plan's 12-pin array + PIN_EDGE_Q1/Q3 to src/view/edgeRouting.ts, ran real-wasm
tests, added a temp diagnostic probe (wrote endpoints to .tmp/probe.txt via fs.appendFileSync
since vitest suppresses console.log), then `git checkout` both files. Working tree confirmed clean.

## Empirical results (the load-bearing facts)
- Facing-side tests with 12 pins: 4/4 real-wasm green. So claim #2 conclusion holds.
- Aligned geometry is a genuine 3-way length TIE (25→25/50→50/75→75 all length 200). Midpoint
  wins on libavoid tie-break, NOT a cost gap. Plan's original "strictly farther" wording was
  wrong; I fixed §2a inline (truthfulness). Not blocking because conclusion verified + §2c anchor.
- Diagonal boxes (off 200/300/400), 12-pin: endpoints at quarter pins, minCorner = 25.0 always.
- Diagonal boxes, OLD 8-pin: endpoints on corners, minCorner = 0.0. => test discriminates.
- CORNER_CLEARANCE_TOL_PX=12 separates 25 vs 0 with 13px margin. Robust. Offset-insensitive =>
  the #QUESTION_FOR_HUMAN is truly non-blocking.

## Judgement
Array correct, tests sound, docs adequate, scope bounded. Only a wording imprecision (fixed
inline). APPROVE-WITH-MINOR, iteration skippable.

## Residual watch-items for IMPLEMENTATION/REVIEW
- §2b prose (on-face, exactly one face) is richer than the two concrete bodies (corner-clearance
  only). Fine, but an on-face assert would be a cheap extra guard.
- Facing-side pass depends on libavoid tie-break; if a wasm upgrade flips it, §2a says investigate
  (don't loosen). §2c remains the deterministic anchor.
