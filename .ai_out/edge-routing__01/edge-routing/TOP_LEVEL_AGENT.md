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
- [ ] Phase: IMPLEMENTATION_WITH_SELF_PLAN (in progress).
- [ ] Phase: IMPLEMENTATION_REVIEW.
- [ ] Phase: IMPLEMENTATION_ITERATION.
- [ ] Final commit + changelog + ticket close.

## Phase agents
- IMPLEMENTATION_WITH_SELF_PLAN: a94af27a434dcb498 (running) → IMPLEMENTATION_WITH_SELF_PLAN__PUBLIC.md

## Explore agents
- layout: aa5c16c1ecfeae0be → EXPLORATION_layout.md
- settings: a3e17035145d85d6c → EXPLORATION_settings.md
- rendering+loader: abc5bd2005cc7408b → EXPLORATION_rendering_loader.md
