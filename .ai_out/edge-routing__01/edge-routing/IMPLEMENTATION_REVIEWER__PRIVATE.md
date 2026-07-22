# edge-routing__01 — IMPLEMENTATION_REVIEWER private memory

Reviewed commit range c924e66..1c2c282 (edge-routing branch). Verdict: **READY** — no blocking issues.

## Independently re-run gates (actual)
- `npm run check` (tsc -noEmit): exit 0, CLEAN.
- `npx vitest run`: **630 passed / 54 files**, exit 0. Matches implementer claim.
- `npm run build`: exit 0; `grep -c "loadAvoid\|ShapeConnectionPin" main.js` = 3 → wasm still embedded.
- Node wasm probe (`.tmp/probe.mjs`): `AvoidLib.load()` OK → integration test's `loaded` flag is TRUE in this env, so its assertions genuinely execute (NOT fake-passed / not skipped).

## Grep acceptance
- `Avoid.`/`avoid.` production usage: ONLY edgeRouting.ts + libavoidLoader.ts (clean).
- Spike files deleted: libavoidSpike.ts, libavoidSpike.test.ts, e2e/libavoidSpike.e2e.ts — gone.
- main.ts: no spike references.
- diff --stat: ONLY test deletions are the throwaway spike tests (ticket-approved). No behavior-capturing tests removed.

## Criteria verification
1. Extraction/absolute coords/group-attachment: edgeRouting.ts:80-112 correct. Collapsed edges already resolved to group ids by buildFlowEdges (no dup group logic). folder-group → groupDimensions rect; else node.width/height square. Tests edgeRouting.test.ts:52-90 cover all.
2. Memory (AvoidArena edgeRouting.ts:138-182): Router owns ShapeRef/ConnRef/Pin (never destroyed by us); only Point/Rectangle/ConnEnd tracked+destroyed; router destroyed LAST in finally dispose(). Points/Rect copied by Rectangle/ShapeRef ctors; ConnEnd copied by ConnRef ctor → safe to free after. Integration test allocs 3 shapes+pins+connector+processTransaction+dispose across 2 routers on shared Avoid, no abort → real evidence of no double-free.
3. Failure containment (GraphViewController.ts:251-266): single try in resolveRoutes, warn-once via routingFailureWarned flag, returns EMPTY_ROUTES, cache nulled. Router THROWS on missing shape (edgeRouting.ts:236) — no per-edge silent skip. Tests 463-487.
4. Setting default OFF: constants.ts:47 DEFAULT_EDGE_ROUTING=false; gate resolveRoutes:237 returns before any router/wasm touch when off; loadAvoid is lazy-imported INSIDE route() so off ⇒ never loads. Test 430. Toggle in settings tab renderLayout (VicinityGraphSettingTab.ts:49-61). Persisted (persistedShapes.ts:132-135), resolver field:51, types:202, override supported. Mirrors groupByFolder/layoutMode.
5. Route cache (GraphViewController.ts:96, 247-257, routingSignature:328): key = obstacle geometry (id,x,y,w,h) + edges (id,src->tgt) = COMPLETE router input → neither too weak (complete) nor unsafe if too strong (over-invalidation only recomputes, never stale). Reuse-layout unchanged ⇒ same signature ⇒ cached (test 489 callCount==1). Flip OFF nulls cache so ON recomputes without forcing elk relayout (decideLayout untouched). Stale passes return before writing cache (no poisoning).
6. Threading: routedPoints FlowEdge (flowMapping.ts:129) → toReactFlowEdge data (VicinityGraphFlow.tsx:189) → VicinityEdgeData (VicinityEdge.tsx:36). Rendering does NOT branch on it. Absolute-space comments present at both boundaries.
7. Lazy `await import("./libavoidLoader")` (edgeRouting.ts:206): JUSTIFIED not hack — static import would pull esbuild-only virtual wasm module into vitest. WHY-comment present. Module cache makes repeat cost negligible. Enables clean test mocking of the loader seam.

## Non-blocking observations
- Extraction silently drops edges w/ endpoint missing position (edgeRouting.ts:106) while router throws on same logical inconsistency (:236). Asymmetric but both guard impossible post-layout states; documented. NICE-TO-HAVE.
- routingSignature assumes stable flow node/edge order; if it ever varied for same id-set → over-invalidation (safe direction). NICE-TO-HAVE.
- routingFailureWarned never resets — by design ("at most once per controller"). Fine.
- console.warn/debug with "vicinity-graph:" prefix + error as separate arg (not embedded) → matches existing pattern & structured-logging rule.

Tests: FakeEdgeRouter (DIP), BDD GIVEN/WHEN/THEN, one meaningful assert each, robust. All present & non-tautological.
