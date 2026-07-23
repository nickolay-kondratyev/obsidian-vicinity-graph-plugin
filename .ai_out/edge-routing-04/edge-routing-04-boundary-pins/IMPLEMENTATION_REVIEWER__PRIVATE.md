# IMPLEMENTATION_REVIEWER — PRIVATE memory (edge-routing__04)

## Verdict: READY (1 SHOULD-FIX, non-blocking)

## Key verifications (don't redo unless code changes)
- check exit 0; test 662/662 green.
- Real-wasm block EXECUTES (libavoid-js resolves in this env → loaded=true). Not skipped.
- Runtime binding: ConnDirUp=1 Down=2 Left=4 Right=8 All=15 (distinct bits). Interface
  additions backed by real values; visDirsFor never returns undefined.
- **CRITICAL SEMANTICS PROVED via direct libavoid-js probe** (`.tmp/probe2/3.mjs`,
  deleted-ephemeral): replicated route() pin logic.
  - Horizontal pair 0..100 / 300..400 → route [[100,50],[300,50]] (A right → B left).
  - Vertical pair → [[50,100],[50,300]] (A bottom → B top).
  - => visDirs = OUTWARD leave direction; spec table matches. Fix works.

## The one real gap
- No test guards facing-side attachment. Real-wasm block only checks "bends around
  blocker" + "no waypoint inside". Inverting visDirs → all 662 still pass. SHOULD-FIX:
  add a facing-side assertion to the real-wasm describe (it runs, so it's cheap).

## Left to TOP_LEVEL (out of my reach)
- Dev-vault: repro near-direct routes, maxDetourRatio drop, perf gate (8 pins × ~100
  obstacles under layout time). Fallback if blown = group-only pins (needs kind threading,
  not implemented — implementer callout a).

## Nits (won't block)
- detourRatio dead undefined-guard (strict-index only).
- detourStats lives in GraphViewController (fine).
