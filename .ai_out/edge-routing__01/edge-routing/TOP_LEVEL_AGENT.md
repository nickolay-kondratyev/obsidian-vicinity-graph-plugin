# TOP_LEVEL_AGENT — edge-routing__01 (routing pass + snapshot threading)

Ticket: `_tickets/edge-routing__01-routing-pass-and-snapshot-threading.md`
Branch: `edge-routing`  |  Feature dir: `.ai_out/edge-routing__01/edge-routing/`
Depends on: spike `edge-routing__00` (CLOSED). Spike findings read: primary data-URL wasm load works; nested-shape attachment works (no group fallback needed for common case); `AvoidArena` in `src/view/libavoidLoader.ts` owns memory (never destroy router-owned ShapeRef/ConnRef/pins); `loadAvoid()` lazy singleton, caches only success. libavoid-js pinned 0.4.5.

## Workflow
IMPLEMENTATION_WITH_SELF_PLAN → IMPLEMENTATION_REVIEW → IMPLEMENTATION_ITERATION (max 4 iters)

## Status log
- [x] Read ticket 01 + spike 00 findings.
- [x] Spawned 3 Explore agents (layout / settings / rendering+loader) → EXPLORATION_*.md.
- [x] Assembled EXPLORATION_PUBLIC.md (pointer index). Committed c924e66.
- [x] Phase: IMPLEMENTATION_WITH_SELF_PLAN → committed 1c2c282. check clean, vitest 630, build green.
- [x] Phase: IMPLEMENTATION_REVIEW → READY, 0 blocking, 0 should-fix, 2 nice-to-have (self-assessed no-change).
- [x] Phase: IMPLEMENTATION_ITERATION → CONVERGED iteration 0 (no cycle; nice-to-haves rejected w/ rationale).
- [x] Final commit + changelog + ticket close (ticket nid_pc87xabr7xi67c4qmht938r2o_e CLOSED).

## Phase agents
- IMPLEMENTATION_WITH_SELF_PLAN: a94af27a434dcb498 (done) → IMPLEMENTATION_WITH_SELF_PLAN__PUBLIC.md. Committed 1c2c282. check clean, vitest 630 pass, build green.
- IMPLEMENTATION_REVIEWER: acc8c6afd623220b1 (running) → IMPLEMENTATION_REVIEW__PUBLIC.md. Diff base c924e66..1c2c282.

## Explore agents
- layout: aa5c16c1ecfeae0be → EXPLORATION_layout.md
- settings: a3e17035145d85d6c → EXPLORATION_settings.md
- rendering+loader: abc5bd2005cc7408b → EXPLORATION_rendering_loader.md
