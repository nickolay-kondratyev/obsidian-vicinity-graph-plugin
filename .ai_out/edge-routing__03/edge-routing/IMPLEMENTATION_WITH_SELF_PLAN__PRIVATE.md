# IMPLEMENTATION_WITH_SELF_PLAN — PRIVATE (edge-routing__03)

## Baseline (verified at start)
- `npm run check` (tsc): EXIT 0.
- `npm test` (vitest): 646 passed / 54 files.
- `npm run test:e2e -- edgeRouting.e2e.ts`: 2/2 passed headless.
- Obsidian binary cached: `.tmp/obsidian/obsidian-1.12.7/obsidian` (OBSIDIAN_PATH auto-provisions via run-e2e.sh).
- No display (DISPLAY/WAYLAND unset) → headless flags auto-applied by run-e2e.sh.
- main.js current size: 2,609,836 B.
- Version stays 0.1.1 across manifest/package/versions — phase 0/1/2 did NOT bump per-phase; RELEASE_CHECKLIST bumps at release cut. LEAVE version alone, note it.

## STATUS: COMPLETE incl. radial-gate follow-up (pending orchestrator commit). All items 1-6 + gate done.
Final verification: tsc EXIT 0; vitest 650 passed/54 files; full e2e 32 passed/0 failed; prod build green, main.js=2,610,310 B.
#QUESTION RESOLVED (human): routing gated OFF for layoutMode==="radial". Gate = `ROUTING_SKIPPED_LAYOUT_MODE`/`isRoutingSkippedLayout` in GraphViewController.ts, checked in resolveRoutes beside the edgeRouting OFF gate. Radial e2e now asserts 0 bends; new controller unit test asserts router never invoked under radial; eval radial asserts routingMs undefined. Docs (arrows.md §5, CHANGELOG) say force+layered route, radial excluded.
Final tuning values: buffer 17, segment 50, crossing 0 (disabled — was blowing perf budget at 100), corner 10.
KEY DECISION: graphFixtures.ts:45 kept edgeRouting:false (NOT flipped) — flipping breaks controller OFF baseline + couples mapping tests to wasm; documented in comment (precedent: layoutMode already decoupled). Version left at 0.1.1 (per-release bump pattern). CLAUDE.md moot (absent). Mobile not verified (no simulator).
To re-measure perf/screenshots: `npm run test:e2e -- edgeRoutingEval.e2e.ts` (reads console.debug timings, writes /.out PNGs). To regen fixtures: `npm run setup:dev-vault` (idempotent).

## Plan / checklist
1. [ ] Item 4 first (default flip) — `constants.ts:47` DEFAULT_EDGE_ROUTING true + WHY; fix `persistedShapes.test.ts:53-61` (default now true) + `graphFixtures.ts:45` (edgeRouting stays false there — it's a layered-mapping fixture; keep false, but verify no test relied on engine default). Actually graphFixtures makeViewSettings hardcodes edgeRouting:false already → unaffected by flip. Confirm.
2. [ ] Item 2 tuning constants in edgeRouting.ts next to EDGE_ROUTING_SHAPE_BUFFER_PX:
   - EDGE_ROUTING_SEGMENT_PENALTY = 50 (libavoid example; each bend ~50px virtual cost → calmer).
   - EDGE_ROUTING_CROSSING_PENALTY = TBD (start 200, validate perf on dense; crossingPenalty is expensive).
   - keep shapeBufferDistance 17 unless screenshots say otherwise.
   - wire via router.setRoutingParameter(avoid.segmentPenalty/crossingPenalty, ...).
   - update WHY comments: constants.ts:42-46, edgeRouting.ts:56, edgeGeometry.ts:135.
3. [ ] Perf instrumentation: console.debug routing pass duration+counts in resolveRoutes; layout duration in runRebuild. Gated/minimal.
4. [ ] Dev-vault fixtures in setup-dev-vault.sh: medium (folder-group heavy, hub-medium.md) + dense (hub-dense.md + dense/n001..nNNN linking only to their own hubs, NOT note1/crowd → no regression to existing specs).
5. [ ] e2e item 1: add setLayoutMode helper to obsidianHarness.ts (mirror setEdgeRouting). Extend edgeRouting.e2e.ts to cover layered + radial (assert real detour where geometrically guaranteed; weaker documented invariant otherwise).
6. [ ] e2e eval spec (edgeRoutingEval.e2e.ts): drive sparse/medium/dense, routing ON, capture screenshots to /.out, capture routing+layout timing from console, assert routing < layout (perf budget). Read PNGs to eyeball route quality.
7. [ ] Docs: arrows.md routing section after `### 4. Layout modes` (:96); CHANGELOG dated entry with main.js delta + "not verified on mobile". CLAUDE.md moot (does not exist).
8. [ ] unit tests: update edgeRouting.test.ts EDGE_ROUTING_SHAPE_BUFFER_PX assertion if changed; add tests asserting new penalty constants exist/values.
9. [ ] Full suite green: check, vitest, e2e. Record real counts.

## Key touchpoints (verified line numbers may drift)
- src/engine/constants.ts:47 DEFAULT_EDGE_ROUTING
- src/view/edgeRouting.ts:58 EDGE_ROUTING_SHAPE_BUFFER_PX; :211 setRoutingParameter; :202 route()
- src/view/edgeGeometry.ts:135 ROUTED_CORNER_RADIUS_PX WHY defer
- src/view/GraphViewController.ts:206 layout call; :215/:230 resolveRoutes; :252 route() call
- src/view/libavoidLoader.ts:25-26 segmentPenalty/crossingPenalty typed
- src/persistence/persistedShapes.test.ts:53-61 default-false assertions
- src/view/testFixtures/graphFixtures.ts:45 edgeRouting:false (hardcoded, independent of engine default)
- e2e/obsidianHarness.ts:298-307 setEdgeRouting (mirror for setLayoutMode)
- e2e/edgeRouting.e2e.ts fixture + assertions

## Commands
- tsc: `npm run check`
- unit: `npm test`
- e2e single: `npm run test:e2e -- edgeRouting.e2e.ts` (redirect to .tmp/)
- prod build (for main.js size): `npm run build` then `ls -la main.js`
- Screenshots land in /.out (gitignored).

## Gotchas
- e2e copies whole .dev-vault each run — new fixtures must NOT link to note1/crowd or existing specs break. Run FULL e2e at end.
- setLayoutMode needs file bounce to re-run pipeline (like setEdgeRouting).
- layered may not geometrically guarantee a crossing → weaker documented assertion, no fake.
- Do NOT git commit (orchestrator commits).
