# EXPLORATION_PUBLIC — 03 force placement quality

Consolidated exploration for the force-placement stranding bug. Two detailed
sub-reports back this summary — read them for depth:
- `EXPLORATION_PIPELINE.md` — full elk-seed → d3-force-refinement pipeline, all
  constants + WHY comments, determinism contract, test infra.
- `EXPLORATION_VAULT.md` — the `we-have-a-finite-amount-of-time` repro graph,
  the stranded "Enchiridion" node's topology, dev-vault + fixture conventions.

## The pipeline (one-paragraph)
`vicinityGraphToElk` (elkMapping.ts) → `GraphLayoutRunner.layout` runs elk
`force` at root as a **seed** (folder-group containers laid out internally via a
layered pass; `SEPARATE_CHILDREN`), then `refineForceRootLayout`
(d3ForceRefinement.ts) re-arranges ONLY the root's direct children (containers +
ungrouped leaves) as rigid boxes with a **static** (run-to-convergence, ~300
ticks) d3-force sim. `extractElkPositions` flattens to absolute coords.

## Forces in the d3 refinement (d3ForceRefinement.ts:57-78)
| force | setting | constant |
|---|---|---|
| link | `.distance = r(src)+r(tgt)+40`; **`.strength()` NOT set** → d3 default `1/min(deg)` | `D3_FORCE_LINK_GAP_PX=40` |
| charge | `forceManyBody().strength(-300)` | `D3_FORCE_CHARGE_STRENGTH=-300` |
| collide | `forceCollide(r).iterations(2)`, r = circumscribed circle + 20 | `D3_FORCE_COLLIDE_PADDING_PX=20`, `..._ITERATIONS=2` |
| x / y | `forceX(0)/forceY(0).strength(0.05)` toward recentred origin | `D3_FORCE_CENTER_PULL_STRENGTH=0.05` |

alpha/alphaDecay/velocityDecay all d3 defaults. Determinism = deterministic elk
seed + fixed-seed LCG (`seededRandom()`, only used to jitter coincident bodies).
**Any fix must preserve this determinism contract** (d3ForceRefinement.ts:12-24).

## Root-cause leads (to VERIFY empirically, not assume)
1. **forceLink.strength unset** — the `D3_FORCE_CENTER_PULL_STRENGTH` WHY comment
   assumes "link strength (~1)", but d3's default is `1/min(deg(src),deg(tgt))`.
   Nodes whose links have degree>1 on both ends get weak pull → the general
   stranding mechanism. **Caveat:** the specific Enchiridion node is degree-1, so
   its edge's default strength is ~1 already — meaning the *specific* screenshot
   may be driven more by (2)/(3) than (1). The fix must reproduce the ACTUAL
   stranding, not a theorized one.
2. **Charge -300 + large container collide radius** inflates `forceLink.distance`
   (r(container) can be large); weak/mismatched pull + fixed charge can leave a
   leaf far from its only partner. Static run from elk seed → local minimum.
3. **elk force seed untuned** (model / iterations / repulsivePower on
   `ELK_FORCE_ROOT_OPTIONS`).

## Approach constraints (from ticket)
- Start with a FAILING quality test/eval over the deterministic pipeline
  (fixture the graph; assert a quality metric, e.g. each node nearer its
  link-partner centroid than unrelated nodes / bounded mean edge length in
  collide-radius units).
- Fix **defaults**, do NOT reach for user settings.
- Keep layout **deterministic**; `npm test` + `npm run check` pass.
- Bring repro data into `.dev-vault/` (or a Fake fixture) — `.out/vaults/public`
  is not source-controlled.
- Document chosen values with WHY comments.

## Best repro paths
- **Layout unit test** (fastest, deterministic, recommended for the eval):
  extend `src/view/D3ForceLayout.test.ts` `hubGraph()` pattern with a metric.
- **Engine → view**: `FakeLinkProvider` + `VicinityEngine.build({outgoingDepth:2})`
  to get realistic 2-hop stranded topology.
- Minimal shape: `main→hub`, `hub→{4-5 neighbors}`, `hub→stranded`, `stranded`
  has no other edges; optionally hub in a grouped folder, stranded in a singleton.

## Existing metrics
Only `overlappingPairCount` (==0) and determinism are asserted today. No
edge-length / crossing metric exists — the fix adds one.
