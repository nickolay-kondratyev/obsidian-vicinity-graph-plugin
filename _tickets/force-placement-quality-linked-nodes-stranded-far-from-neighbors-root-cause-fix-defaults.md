---
id: nid_apkpp62otiz0qhxlxoqhe5l1r_e
title: "force placement quality: linked nodes stranded far from neighbors (root-cause + fix defaults)"
status: open
deps: [nid_ihlfchb69wt1hqot6iqy7a9m9_e]
links: []
created_iso: 2026-07-23T23:34:17Z
status_updated_iso: 2026-07-23T23:34:17Z
type: bug
priority: 1
assignee: CC_WITH-nickolaykondratyev
tags: [layout, force, quality]
---

Observed: with Organic (force) on note we-have-a-finite-amount-of-time.md in .out/vaults/public, node "The Enchiridion (The Manual)" is placed mid-graph, far from its link partners, producing long crossing edges (screenshot .tmp/Screenshot From 2026-07-23 17-22-17.png, 2026-07-23).

Pipeline: elk force seed (src/view/elkMapping.ts, ELK_FORCE_ROOT_OPTIONS at src/view/constants.ts:104) then static d3-force refinement (src/view/d3ForceRefinement.ts:57-78) with constants at src/view/constants.ts:117-140.

Hypothesized root causes (verify, then fix defaults — do NOT reach for user settings first):
1. Link strength is d3 default 1/min(degree(source),degree(target)) — forceLink.strength() is never set (src/view/d3ForceRefinement.ts:61-66). Around the active-note hub every link is weak (~0.1), so "linked boxes sit close" is unenforced exactly where it matters. Try constant strength ~0.7-1.
2. Static run from elk seed → local minimum: a centrally-seeded node is caged by neighbors collide circles; center pull (D3_FORCE_CENTER_PULL_STRENGTH=0.05) holds it there. Try slower alphaDecay (more ticks), or re-heat/restart passes; keep determinism (seeded LCG, src/view/d3ForceRefinement.ts:108).
3. elk force seed untuned: consider elk.force.model (FRUCHTERMAN_REINGOLD vs EADES), elk.force.iterations, elk.force.repulsivePower on ELK_FORCE_ROOT_OPTIONS.

Approach:
- Start with a failing/eval test: deterministic pipeline means we can fixture the vault graph and assert a quality metric (e.g. mean edge length in collide-radius units, or specifically: each node closer to centroid of its link partners than to unrelated nodes). Consider small eval harness like e2e/edgeRoutingEval.e2e.ts but unit-level over Fake fixtures.
- Tune constants + link strength until the Enchiridion-style stranding disappears on the public vault without collapsing hub packing (see WHY comments at src/view/constants.ts:111-133 — charge deliberately moderate, center pull must stay << link strength).
- Layout must stay deterministic (test-stability contract in d3ForceRefinement.ts doc comment).
- Document chosen values with WHY comments.

## Acceptance Criteria

- New quality test/eval fails on current defaults and passes after fix.
- Visual check on .out/vaults/public note we-have-a-finite-amount-of-time.md: The Enchiridion (The Manual) sits adjacent to its link partners; no long stranded edges.
- Layout deterministic; npm test + npm run check pass.

