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

---

## Round 2 (c060122 group-only pins + telemetry fix) — Verdict: READY (0 blocking/should-fix)

Both Round-1 open items CLOSED:
- SHOULD-FIX (facing-side test) → 2 new real-wasm tests assert right→left / bottom→top
  border attachment on FOLDER-GROUP obstacles. Genuine: centre pins would fail them.
- Implementer callout (a) (group-only pins needs kind threading) → done via
  RoutingObstacle.kind sourced from FlowNode.kind (closed union note|folder-group).

Verified:
- check 0; test 664/664 (was 662 + 2). Real-wasm executes (loaded=true, 2ms/0ms).
- registerPinsForShape: every shape ≥1 PIN_CLASS pin (group=8, note=1) → no pinless edge.
- Telemetry: clippedRoutes computed once; same map logged+cached+returned; isStale moved
  after log but before cache write → stale still returns EMPTY, never caches. False-pass
  closed (eval measures obstacles=101). detourRatio guards chord==0 / missing endpoints.
- No anchors in touched files; no behavior test removed; sizing logic unchanged (only
  kind label added). Note→note keeps pre-04 centre-pin behaviour (no regression).

Nits only: per-call [CENTRE_PIN_SPEC] alloc; debug line per non-stale pass. Non-blocking.
