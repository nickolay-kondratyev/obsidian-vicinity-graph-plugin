# PLANNER__PRIVATE — 03 force placement quality (rehydrate memory)

## Verified facts (working tree, 2026-07-23)
- Pipeline: `vicinityGraphToElk` (elkMapping.ts) → `GraphLayoutRunner.layout` (elk `force` SEED, SEPARATE_CHILDREN so folder containers laid out internally via layered pass) → `refineForceRootLayout` (d3ForceRefinement.ts, static ~300-tick d3-force on ROOT direct children only) → `extractElkPositions`.
- d3ForceRefinement.ts:57-78 forces: link `.distance = r(src)+r(tgt)+40`, **`.strength()` NEVER set** → d3 default `1/min(deg(src),deg(tgt))`; charge `-300`; collide `(hypot(w,h)/2 + 20)` iterations 2; x/y `forceX(0)/forceY(0).strength(0.05)`. alpha/alphaDecay/velocityDecay = d3 defaults; tick count = `ceil(ln(alphaMin)/ln(1-alphaDecay))` ≈ 300 (self-adjusting).
- Determinism = deterministic elk seed + fixed-seed LCG `seededRandom()` (only jitters coincident bodies). Contract doc at d3ForceRefinement.ts:12-24. MUST preserve.
- Constants + WHY in src/view/constants.ts:81-112. Center-pull WHY (line 100-104) claims "must stay well below link strength (~1)" — FALSE given default `1/min(deg)`. Reconcile.

## Root-cause reasoning (KEY, honest)
- Enchiridion = **degree-1 leaf** off Epictetus hub. d3 default strength = 1/min(deg)=1/1=**1 already**. So "weak link strength" (root-cause #1) does NOT explain THIS node. Even under folder-group projection (Epictetus in a `p/Epictetus` container absorbing many edges), min(containerDeg, 1)=1 → strength still 1.
- Actual Enchiridion mechanism = compound: (a) resting distance measured from the LARGE container's circumscribed collideRadius (hypot/2 can be 150-300px) → leaf rests FAR (long edge); (b) link force constrains distance-to-hub but NOT angle → leaf free to park among unrelated clusters; (c) static run from elk seed + charge(-300) + collide caging → angular local minimum, not recovered in 300 ticks. Net: leaf stranded mid-graph, long crossing edge.
- Two DISTINCT mechanisms in the general bug: (1) weak link strength for degree>1-both-ends edges (link-strength lever); (2) charge-vs-link equilibrium + local minimum for ANY leaf incl. degree-1 (charge/relaxation lever). Enchiridion = mechanism 2.

## Metric decision
Chose **edge stretch ratio** = centerDistance(src,tgt) / restingTarget where restingTarget = collideRadius(src)+collideRadius(tgt)+D3_FORCE_LINK_GAP_PX. Well-placed ≈1; stranded >>1. Assert `max stretch ≤ MAX_EDGE_STRETCH` (test-local const, calibrate ~2.0). Self-normalizing, cheap, deterministic, robust to added nodes (per-edge). Rejected "partner-centroid vs nearest-unrelated" (brittle in dense packing across big containers).

## Fix decision (Pareto)
- Approach 1 (baseline, cheap, defensible): pin `forceLink.strength(D3_FORCE_LINK_STRENGTH=1)` — reconciles WHY comment, fixes general degree>1 stranding. Does NOT change Enchiridion forces (already 1).
- Approach 2 (the degree-1 lever): moderate charge reduction (-300 → ~-150..-180). Directly tightens packing so leaf settles closer + fewer unrelated boxes between partners. Needs overlap==0 recheck (collide handles overlaps independently, should hold).
- Approach 3 (relaxation: slower alphaDecay / re-heat): escape local minima. More compute + moving parts; use only if 1+2 insufficient. Determinism care.
- Approach 4 (tighter link distance for big containers): shortens inflated resting distance; risk of link<collide overlaps. Last resort.
- RECOMMENDATION: empirically-driven. Start Approach 1 + build failing metric test on an Enchiridion-mirroring fixture. If degree-1 leaf still strands, add Approach 2. Avoid 3/4 unless needed. Minimal set, WHY comments, re-verify overlap+determinism.

## Reproduction locus
- PRIMARY: layout-level (makeGraph → vicinityGraphToElk → GraphLayoutRunner → extractElkPositions), extend D3ForceLayout.test.ts. Folder grouping IS reachable here: give hub + 1 sibling folder `p/ep` (2 members ⇒ container via MIN_GROUP_MEMBER_COUNT=2), stranded leaf alone in `p/ep/book` ⇒ ungrouped leaf. Reproduces big-container projection.
- Engine-level (FakeLinkProvider→VicinityEngine) only as fallback for realistic degrees; NOT needed since grouping reachable at layout level.
- RISK: fixture may not strand on current defaults. Implementer MUST iterate fixture (raise neighbor count, add competing clusters, tune sizes) until metric FAILS pre-fix; document topology needed.

## Dev-vault
- Automated regression = SELF-CONTAINED makeGraph fixture (no dev-vault dep). CONFIRMED reading.
- Dev-vault notes = MANUAL visual acceptance only. Add via `scripts/setup-dev-vault.sh` write_if_missing (source-controlled; `.dev-vault/` itself gitignored). Mirror Epictetus subgraph, bare-basename wikilinks: main `we-have-a-finite-amount-of-time` → memento-mori/you-will-die/regret-minimization/Epictetus; Epictetus → philosopher-of/stoicism/author-of/![[The-Manual-Enchiridion]]/![[th]]; Enchiridion in `p/Epictetus/book/` singleton folder; Epictetus in `p/Epictetus/`.

## Files to change
1. src/view/constants.ts — new `D3_FORCE_LINK_STRENGTH`; maybe adjust `D3_FORCE_CHARGE_STRENGTH`; reconcile center-pull WHY.
2. src/view/d3ForceRefinement.ts — `.strength(D3_FORCE_LINK_STRENGTH)` on forceLink; (only if needed) alphaDecay/tick.
3. src/view/D3ForceLayout.test.ts — failing-first stretch-metric test + stranded fixture.
4. scripts/setup-dev-vault.sh — Epictetus/Enchiridion fixture notes.
5. docs-internal/CHANGELOG.md + ticket close (conventions).

## Open questions → human
- Visual acceptance references `.out/vaults/public` (not source-controlled). Confirm mirrored dev-vault subgraph is an acceptable substitute for the visual criterion.

## Rejected
- User-setting changes (ticket forbids; fix defaults).
- Partner-centroid metric (brittle).
- Re-heat / alphaDecay change as FIRST lever (complexity/determinism risk).
- Engine-level fixture as primary (unnecessary; grouping reachable at layout level).
