# Force Layout Pipeline — Exploration Report

Scope: full trace of the elk-force-seed → d3-force-refinement pipeline that
places root-level node/folder-group boxes in the vicinity graph view. Written
for a planner fixing a "linked nodes get stranded far apart, long crossing
edges" quality bug. All line numbers verified against the working tree at
exploration time (2026-07-23).

## 1. Full data flow

```
VicinityGraph (engine output)
  │
  ▼
vicinityGraphToElk()                              src/view/elkMapping.ts:30
  - builds ElkNode leaves (one per graph node, sized via nodeDimensionsPx)
  - derives folder-group containers (deriveFolderGroups) and nests member
    leaves under a container ElkNode per group
  - intra-group edges are attached to their container; every other edge
    ("cross-boundary") is PROJECTED onto root-level ids (containers collapse
    to their folder-group id) via projectedRootEdges() (elkMapping.ts:86)
  - returns ONE root ElkNode: id="root", layoutOptions=ELK_FORCE_ROOT_OPTIONS,
    children = [...containers, ...ungroupedLeaves], edges = projected root edges
  │
  ▼
GraphLayoutRunner.layout(elkRootNode)              src/view/GraphLayoutRunner.ts:17
  1. this.elk.layout(graph)  → ElkLayoutRunner (thin wrapper over elkjs
     `elk.bundled.js`, in-thread, node-testable) — src/view/ElkLayoutRunner.ts:14
     Runs elk's "force" algorithm at the ROOT (ELK_FORCE_ROOT_OPTIONS:
     elk.algorithm=force). Because elk's force algorithm does NOT support
     INCLUDE_CHILDREN, elk falls back to its default SEPARATE_CHILDREN
     hierarchy handling: each folder-group container is laid out
     INTERNALLY first using a separate "layered" pass (ELK_GROUP_MEMBER_
     OPTIONS), producing a fixed-size box; the root force pass then only
     arranges those container boxes + ungrouped leaf boxes against each
     other and against the projected root edges. This elk force pass is
     explicitly documented as ONLY A SEED, not the final placement.
  2. isForceRoot check (GraphLayoutRunner.ts:19-20): only when the root's
     `elk.algorithm` option equals ELK_FORCE_ROOT_OPTIONS's value ("force")
     does the pipeline continue to step 3; otherwise the elk-only result is
     returned as-is (other layout modes: layered/radial, not covered here).
  3. refineForceRootLayout(laidOut)                 src/view/d3ForceRefinement.ts:35
     Takes the elk-produced root ElkNode (with x/y/width/height already set
     on every root child by elk's force seed) and RE-ARRANGES ONLY THE ROOT'S
     DIRECT CHILDREN (containers + ungrouped leaves) using a static (run-to-
     convergence, non-animated) d3-force simulation. Children's internal
     layouts (elk's layered pass inside each container) are left untouched —
     d3 only ever touches whole containers/leaves as rigid boxes.
  │
  ▼
extractElkPositions(laidOut)                       src/view/elkMapping.ts:134
  Flattens the (elk seed + d3 refined) tree into ABSOLUTE positions per node
  id, accumulating parent offsets recursively (needed because elk reports
  child coords relative to their parent, and folder-group members are nested).
extractElkDimensionsById(laidOut)                   src/view/elkMapping.ts:154
  Collects each child's {width,height} (used for folder-group container
  boxes elsewhere in the view).
  │
  ▼
GraphViewController.runRebuild()                    src/view/GraphViewController.ts:213-223
  positions/groupDimensions feed edge routing (resolveRoutes, AFTER layout,
  BEFORE publish) and ultimately React Flow node placement.
```

Entry point invocation site (GraphViewController.ts:213):
```ts
const laidOut = await this.layoutRunner.layout(vicinityGraphToElk(graph));
...
positions = extractElkPositions(laidOut);
groupDimensions = extractElkDimensionsById(laidOut);
```
`this.layoutRunner` is typed as `GraphLayoutPort` (src/view/viewPorts.ts:48-50:
`interface GraphLayoutPort { layout(graph: ElkNode): Promise<ElkNode>; }`) and
is concretely a `GraphLayoutRunner` in production wiring (composes
`ElkLayoutRunner` + `refineForceRootLayout`); tests substitute a `FakeLayout`
(see §5).

Note: relayout is SKIPPED entirely when `decideLayout()` returns
"reuse-layout" (GraphViewController.ts:200-208) — a structural-diff check that
reuses previous positions/groupDimensions and only refreshes node data. This
is orthogonal to the force-quality bug but matters if the fix should also
apply retroactively to already-laid-out graphs (it will not, on a data-only
refresh).

## 2. Every relevant constant (src/view/constants.ts)

### `ELK_FORCE_ROOT_OPTIONS` — constants.ts:76-79
```ts
export const ELK_FORCE_ROOT_OPTIONS: Readonly<Record<string, string>> = {
	"elk.algorithm": "force",
	"elk.spacing.nodeNode": ELK_NODE_SPACING,
};
```
WHY comment (constants.ts:67-75), verbatim:
> Root layout options. elk's `force` algorithm is only the SEED: it computes
> folder-container dimensions and a rough untangled arrangement, then the
> d3-force refinement (`d3ForceRefinement.ts`) packs the root-level boxes
> tightly. `force` does not support `INCLUDE_CHILDREN`, so the root runs elk's
> default `SEPARATE_CHILDREN` hierarchy handling: folder containers are laid out
> internally first (see {@link ELK_GROUP_MEMBER_OPTIONS}), then the root arranges
> the resulting fixed-size boxes.

`ELK_NODE_SPACING` (constants.ts:65) = `"40"` — WHY (constants.ts:64):
> Minimum gap between sibling nodes, shared by every elk algorithm we run.

### `D3_FORCE_CHARGE_STRENGTH` — constants.ts:89
```ts
export const D3_FORCE_CHARGE_STRENGTH = -300;
```
WHY (constants.ts:83-88), verbatim:
> Repulsion between root-level boxes (d3 `forceManyBody` strength; negative =
> repel). Deliberately moderate — collision + link distances do the packing,
> the charge only untangles; a strong charge would re-create the dispersion the
> d3 refinement exists to fix.

### `D3_FORCE_LINK_GAP_PX` — constants.ts:92
```ts
export const D3_FORCE_LINK_GAP_PX = 40;
```
WHY (constants.ts:91):
> Free space kept along a link between the two endpoint boxes' collide circles.

### `D3_FORCE_COLLIDE_PADDING_PX` — constants.ts:98
```ts
export const D3_FORCE_COLLIDE_PADDING_PX = 20;
```
WHY (constants.ts:94-97), verbatim:
> Padding added to each box's circumscribed-circle collide radius, so two
> touching circles still leave a visible gap between the boxes inside them.

### `D3_FORCE_CENTER_PULL_STRENGTH` — constants.ts:105
```ts
export const D3_FORCE_CENTER_PULL_STRENGTH = 0.05;
```
WHY (constants.ts:100-104), verbatim:
> Weak pull of every box toward the layout centre (d3 `forceX`/`forceY`
> strength). Keeps weakly-connected satellites from drifting off; must stay
> well below the link strength (~1) or the graph collapses onto the hub.

**This comment is directly relevant to the bug**: it references "the link
strength (~1)" as if forceLink's strength were pinned near 1, but (see §3
below) the code never calls `.strength()` on `forceLink`, so the actual
strength is d3's per-link default `1 / min(sourceDegree, targetDegree)` —
which for high-fan-out hub nodes (many neighbours ⇒ high hub degree) can be
FAR below 1 for hub-adjacent links (e.g. a 24-neighbour hub gives a min-degree
of 1 on each leaf side... actually min(hubDegree, leafDegree); leaf degree is
usually 1, so strength ≈ 1/1 = 1 for pure hub-spoke edges — but any node
appearing on the low-degree side of multiple links, or in denser subgraphs,
gets a materially weaker link relative to the assumption in this WHY comment).
This mismatch between the documented assumption ("link strength ~1") and the
undocumented, non-overridden default is a strong candidate root cause: for
graphs with any node of degree > 1, forceLink strength dips below 1, and the
already-weak 0.05 center pull plus -300 charge can then dominate, stranding a
node whose only edge has strength e.g. 1/3 or 1/5, far from its neighbor,
producing a long edge.

### `D3_FORCE_COLLIDE_ITERATIONS` — constants.ts:112
```ts
export const D3_FORCE_COLLIDE_ITERATIONS = 2;
```
WHY (constants.ts:107-111), verbatim:
> d3 `forceCollide` relaxation passes per tick. 1 leaves residual overlaps on
> dense hubs; 2 resolves them (d3 docs recommend raising iterations when
> overlap-freedom matters more than speed).

### `ELK_GROUP_MEMBER_OPTIONS` — constants.ts:120-124
```ts
export const ELK_GROUP_MEMBER_OPTIONS: Readonly<Record<string, string>> = {
	"elk.algorithm": "layered",
	"elk.direction": ELK_DIRECTION,
	"elk.spacing.nodeNode": ELK_NODE_SPACING,
};
```
WHY (constants.ts:114-119), verbatim:
> Layout of the INSIDE of a folder-group container. The force root runs
> `SEPARATE_CHILDREN`, laying out every container independently: members are
> arranged with elk's proven layered algorithm, then the container is placed as
> a fixed-size box by the root force/d3 pass.

### `ELK_GROUP_PADDING` — constants.ts:132
```ts
export const ELK_GROUP_PADDING = "[top=36.0,left=16.0,bottom=16.0,right=16.0]";
```
WHY (constants.ts:126-131), verbatim:
> Inner padding of folder-group containers (elk `ElkPadding` syntax). The
> extra TOP padding reserves room for the group's folder-name label so member
> nodes never render underneath it; the other sides give members breathing
> room inside the container border.

### `ELK_DIRECTION` — constants.ts:62 = `"DOWN"`, WHY (constants.ts:58-61):
> Primary axis elk lays the folder-group members along (the layered pass inside
> each container — see {@link ELK_GROUP_MEMBER_OPTIONS}). Kept as a constant (not
> inlined) so it is trivially retargetable. `DOWN` = classic top-to-bottom rows.

### `ELK_ROOT_ID` — constants.ts:55 = `"root"`.
> Id of the synthetic elk root that contains every graph node.

Not directly force-related but co-located and possibly relevant to "layout
looks stranded/off-screen": `GRAPH_MIN_ZOOM` (constants.ts:140) = 0.1, WHY
(constants.ts:134-139) about React Flow fitView zoom floor on dense graphs —
NOT part of the force math itself, just the viewport fit-to-screen afterward.

## 3. `forceLink.strength()` — confirmed NOT SET (d3 default applies)

Exact code, src/view/d3ForceRefinement.ts:59-67:
```ts
.force(
    "link",
    forceLink<ForceBody, SimulationLinkDatum<ForceBody>>(links)
        .id((body) => body.id)
        .distance(
            (link) =>
                (link.source as ForceBody).collideRadius + (link.target as ForceBody).collideRadius + D3_FORCE_LINK_GAP_PX,
        ),
)
```
Only `.id()` and `.distance()` are called on the `forceLink` instance. There is
NO `.strength()` call anywhere in this file (verified: `grep -n "strength" src/view/d3ForceRefinement.ts` matches only the `forceManyBody(...).strength(D3_FORCE_CHARGE_STRENGTH)` charge force at line 68, `forceX<ForceBody>(0).strength(...)` at line 73, and `forceY<ForceBody>(0).strength(...)` at line 74 — never on `forceLink`).

Per d3-force's documented behavior (v3, matching `"d3-force": "^3.0.0"` in
package.json:21), when `strength` is not explicitly set, `forceLink`
recomputes it per-tick as:
```
strength(link) = 1 / min(count(link.source), count(link.target))
```
where `count(node)` is the number of links incident to that node. This means:
- A simple hub-and-spoke edge where the spoke leaf has degree 1 gets
  strength = 1 (min(hubDegree, 1) = 1) — link pulls at full strength.
- Any edge where BOTH endpoints have degree > 1 (e.g. chains, cross-links,
  siblings that also link to each other, or a folder-group projected onto a
  single container id absorbing multiple member edges — see
  `projectedRootEdges` in elkMapping.ts:86, which can make a container's
  projected node accumulate many distinct root edges) gets a strength well
  below 1 (e.g. degree-3 node ⇒ strength ≤ 1/3), i.e. a MUCH weaker pull than
  the `D3_FORCE_CENTER_PULL_STRENGTH` comment assumes ("must stay well below
  the link strength (~1)"). This is the most concrete lead for the "stranded
  node, long crossing edge" bug: when a node's only edges are weak
  (low-strength) due to high degree on the OTHER endpoint, and charge
  (-300) + collide are pushing it away, nothing pulls it back in — the 0.05
  center pull is comparatively strong at that point and can pull it toward
  the global centroid rather than toward its actual neighbor, producing long
  edges that cross other, tightly-linked node pairs.

## 4. alpha / alphaDecay / tick count & determinism

File-level doc comment, src/view/d3ForceRefinement.ts:12-24 (verbatim, this is
also the "layout determinism / test-stability contract" comment requested):
```
/**
 * d3-force refinement of a `force`-mode root (the reactflow.dev force-layout
 * approach, run statically to convergence instead of animated). Input is the
 * elk-laid-out root: elk already sized the folder containers and produced a
 * rough seed arrangement; this pass re-arranges ONLY the root's direct children
 * (containers + ungrouped leaves) so linked boxes sit close and unlinked boxes
 * merely stop overlapping — the tight hub packing elk's own force pass cannot
 * deliver. Children's internal layouts are untouched.
 *
 * Deterministic: seeds come from elk (deterministic) and the simulation's
 * random source is a fixed-seed LCG, so the same graph always lays out
 * identically (matches the elk runner's contract and keeps tests stable).
 */
```

Simulation construction & run, d3ForceRefinement.ts:57-78:
```ts
const simulation = forceSimulation(bodies)
    .randomSource(seededRandom())
    .force("link", forceLink<...>(links).id(...).distance(...))
    .force("charge", forceManyBody<ForceBody>().strength(D3_FORCE_CHARGE_STRENGTH))
    .force("collide", forceCollide<ForceBody>((body) => body.collideRadius).iterations(D3_FORCE_COLLIDE_ITERATIONS))
    .force("x", forceX<ForceBody>(0).strength(D3_FORCE_CENTER_PULL_STRENGTH))
    .force("y", forceY<ForceBody>(0).strength(D3_FORCE_CENTER_PULL_STRENGTH))
    .stop();
// Run to convergence synchronously (the d3 "static layout" recipe): the tick
// count is exactly how many decays alpha needs to fall below alphaMin.
simulation.tick(Math.ceil(Math.log(simulation.alphaMin()) / Math.log(1 - simulation.alphaDecay())));
```
- `.stop()` immediately halts d3's internal auto-ticking timer (the animated
  mode is not used); the caller drives ticks manually and synchronously —
  the standard d3 "static layout" recipe (compute total ticks needed for
  alpha to decay below alphaMin, then call `.tick(n)` once).
- `alphaMin`, `alphaDecay`, `alpha` (initial, default 1), and `velocityDecay`
  are ALL left at d3-force defaults — none of these are set anywhere in this
  file or in constants.ts (only `D3_FORCE_*` constants above are read).
  d3-force v3 defaults: `alpha = 1`, `alphaMin = 0.001`, `alphaDecay =
  1 - alphaMin^(1/300)` ≈ `0.0228`, `alphaTarget = 0`, `velocityDecay = 0.4`.
  So `simulation.tick(n)` runs `n = ceil(ln(0.001) / ln(1 - 0.0228))` ≈ 300
  ticks — the standard d3 "300 ticks to convergence" convention, computed
  generically from whatever `alphaMin`/`alphaDecay` currently are (so if a
  planner changes those constants — currently NOT overridden — the tick count
  formula would still self-adjust, but nobody currently overrides them).
- Determinism source: `seededRandom()` (d3ForceRefinement.ts:108-115):
```ts
/**
 * Fixed-seed LCG (Numerical Recipes constants: state*1664525+1013904223 mod
 * 2^32) replacing `Math.random` inside the simulation, which only consults it
 * to jiggle exactly-coincident bodies apart.
 */
function seededRandom(): () => number {
	const MODULUS = 2 ** 32;
	let state = 1;
	return () => {
		state = (state * 1664525 + 1013904223) % MODULUS;
		return state / MODULUS;
	};
}
```
  d3-force only calls `random()` to perturb exactly-coincident node positions
  (jitter), so this seeded LCG only matters when two bodies start at the same
  (x,y) — otherwise the simulation is already deterministic because elk's seed
  positions and all forces are pure functions of input.
- Seed positions come from elk (deterministic elk layout, ElkLayoutRunner.ts),
  converted to d3 "center" coordinates and RECENTRED so the seed centroid sits
  at the origin (recentre(), d3ForceRefinement.ts:94-101) — this is the point
  `forceX(0)`/`forceY(0)` pull toward, so recentring keeps the pull's target
  aligned with the actual seed cluster centroid rather than an arbitrary elk
  origin.
- Coordinate conversion at the end (d3ForceRefinement.ts:87-88): d3 uses box
  CENTERS; elk uses top-left; the final mapping subtracts halfWidth/halfHeight
  back out: `{ x: body.x - body.halfWidth, y: body.y - body.halfHeight }`.

Early-exit guard: `if (children.length < 2) return root;` (d3ForceRefinement.ts:37-39)
— refinement is skipped entirely for 0 or 1 root children ("Nothing to
arrange").

## 5. Test infrastructure & Fake providers reusable for a unit-level eval test

### View-layer fixture builders — src/view/testFixtures/graphFixtures.ts
- `makeNode(overrides: Partial<GraphNode> = {})` (graphFixtures.ts:10-26):
  plain-object `GraphNode` factory with sane defaults (`sizePx: 100`,
  `minDepth: 1`, `folder: asFolderPath("")`, etc.), overridable per test.
- `makeEdge(source, target, count = 1)` (graphFixtures.ts:30-32): builds a
  `GraphEdge`.
- `makeGraph(overrides: Partial<VicinityGraph> = {})` (graphFixtures.ts:55-64):
  wraps nodes/edges plus a neutral `makeViewSettings()` (graphFixtures.ts:35-53,
  private) with `groupByFolder: true`, `nodeCap: 100`, etc.
These require NO engine run, NO obsidian, NO React — pure structural fixtures,
directly usable by a new force-pipeline eval test.

### Force-pipeline-specific existing tests

- `src/view/D3ForceLayout.test.ts` — the closest existing analog to what a new
  eval test would extend. Key pieces:
  - `hubGraph()` (D3ForceLayout.test.ts:22-34): ONE central hub
    (`sizePx: 160`) with `NEIGHBOR_COUNT = 24` neighbours (`sizePx: 80`),
    edges alternate direction (`index % 2 === 0` hub→neighbor vs
    neighbor→hub) to mirror "mixed link directions" — explicitly called out
    as "mirroring the motivating screenshot (a hub note with dozens of
    links)" (D3ForceLayout.test.ts:17).
  - `laidOutBoxes(graph)` (D3ForceLayout.test.ts:43-52): runs the REAL
    `GraphLayoutRunner` (elk + d3, headless in Node) end-to-end and returns
    `{path, x, y, side}` boxes.
  - `overlappingPairCount(boxes)` (D3ForceLayout.test.ts:54-66): O(n²)
    AABB-overlap counter — currently the only quantitative quality metric in
    the suite (asserts `toBe(0)`, i.e. no overlaps). There is NO existing
    metric for edge length / crossing / "stranded node" quality — a new eval
    would need to add e.g. an edge-length or edge-crossing metric using the
    same `laidOutBoxes` helper pattern.
  - Determinism test (D3ForceLayout.test.ts:77-79): `expect(await
    laidOutBoxes(hubGraph())).toEqual(await laidOutBoxes(hubGraph()))`.
  - A second describe block (D3ForceLayout.test.ts:82-124) covers a
    folder-grouped fixture, asserting container dimensions, absolute
    positions for both grouped members and containers, and that members stay
    INSIDE their container box after d3 refinement.
- `src/view/ElkLayout.test.ts` — covers the plain `ElkLayoutRunner` alone
  (the seed only, no d3 refinement); explicitly notes "the full force
  pipeline (elk seed + d3 refinement) is covered end-to-end in
  `D3ForceLayout.test.ts`" (ElkLayout.test.ts:12-13).
- `src/view/elkMapping.test.ts` — pure mapping tests (`vicinityGraphToElk`,
  `extractElkPositions`), no elk/d3 engines run for most cases (uses
  hand-built `ElkNode` fixtures for `extractElkPositions` tests, lines 35-52),
  plus folder-group compound mapping tests further down the file.
- `src/view/GraphViewController.test.ts` — controller-level tests using a
  `FakeLayout implements GraphLayoutPort` (GraphViewController.test.ts:84-97)
  that stamps deterministic, distinct coordinates (`index * 200, y: 0`) rather
  than running real elk/d3 — useful as a pattern for controller-level tests,
  NOT useful for force-quality itself (it bypasses the real algorithm).
  Also has `FakeGraphSource implements GraphSourcePort` (lines 53-70) driven
  by manually-resolved `Deferred` promises for concurrency control.

### Engine-side fixture infra (for building `VicinityGraph` via the real engine, if a test wants realistic graph shapes rather than hand-built `makeGraph`)

- `src/engine/FakeLinkProvider.ts` — in-memory `LinkProvider` implementation
  over a declarative `FakeVaultSpec { files: FakeFileSpec[]; links?:
  Record<string, string[]> }` (FakeLinkProvider.ts:21-24). Construct via
  `new FakeLinkProvider(spec)`, then drive the real engine
  (`VicinityEngine`/`GraphBuilder`, not explored in this pass) against it to
  get a real, engine-produced `VicinityGraph` with realistic depth/edge
  structure instead of a hand-authored `makeGraph`.
- `src/engine/testFixtures/denseVaultFixtures.ts` — "Committed, deterministic
  dense-vault fixture generator (step-07 hardening)" (denseVaultFixtures.ts:4)
  including a documented "~500-node mixed vault for cap/determinism/timing
  regression: a hub fanning..." fixture (denseVaultFixtures.ts:221) and a
  `SeededRandom` deterministic generator (tested in
  `denseVaultFixtures.test.ts:54`, "SeededRandom determinism") — the largest
  ready-made realistic hub-fanout fixture in the repo if an eval needs more
  than 24 neighbours.

### Eval-style harness (Playwright e2e, NOT unit-level)

- `e2e/edgeRoutingEval.e2e.ts` — an EVAL harness, explicitly distinguished
  from a "tight regression" (edgeRoutingEval.e2e.ts:8-9: "Evaluation harness
  for edge-routing__03 — NOT a tight regression (that is `edgeRouting.e2e.ts`)").
  It drives real dev-vault fixtures (sparse/medium/dense, from
  `scripts/setup-dev-vault.sh`) through a real Obsidian harness
  (`ObsidianHarness`), switches `LayoutMode` ("force"/"layered"/"radial"),
  captures screenshots to `.out/edge-routing-*.png` for human/agent eyeballing,
  and parses `console.debug` perf timing lines the controller emits
  (`"elk+d3 layout pass"`, `"edge routing pass"` — see
  GraphViewController.ts:210-215 for the actual `console.debug` call this
  parses). It does NOT verify visual force-layout QUALITY (edge length /
  crossings) — only that routing stays fast relative to layout and that edges
  render. This is the closest existing scaffold for a NEW visual quality eval
  (screenshot capture + real Obsidian harness + real dense/medium/sparse
  fixtures already wired via `scripts/setup-dev-vault.sh`), but a new
  force-placement quality eval would most naturally be a Vitest unit test
  extending `D3ForceLayout.test.ts`'s pattern with a quantitative edge-length/
  crossing metric, not a Playwright screenshot eval.

## 6. Layout determinism / test-stability contract doc comment

Already quoted in full in §4 above (src/view/d3ForceRefinement.ts:12-24). The
operative sentence:
> Deterministic: seeds come from elk (deterministic) and the simulation's
> random source is a fixed-seed LCG, so the same graph always lays out
> identically (matches the elk runner's contract and keeps tests stable).

This "matches the elk runner's contract" phrase refers back to
`ElkLayoutRunner`'s own determinism, exercised by `ElkLayout.test.ts:40-44`
("WHEN laid out twice THEN the result is deterministic") and
`D3ForceLayout.test.ts:77-79` (same assertion for the full elk+d3 pipeline).
**Any fix to the force constants/algorithm must preserve this determinism
contract** — i.e. any new randomness must go through the same seeded LCG
(`seededRandom()`, d3ForceRefinement.ts:108-115), and any change to `.tick()`
count or `alphaMin`/`alphaDecay` must keep the run-to-convergence formula
(d3ForceRefinement.ts:78) self-consistent so tests calling the pipeline twice
still get bit-identical output.

## Summary of concrete bug leads for the planner

1. **`forceLink` has no `.strength()` override** — the d3 default
   `1/min(deg)` means any node whose neighbor has degree > 1 gets a pull
   markedly weaker than the `D3_FORCE_CENTER_PULL_STRENGTH` WHY comment
   assumes ("must stay well below the link strength (~1)"). This is the
   single most likely defect: for real vicinity graphs (not pure hub-spoke),
   many edges have both endpoints at degree > 1, weakening the very force
   meant to keep linked boxes close.
2. **`D3_FORCE_CHARGE_STRENGTH = -300`** is a fixed repulsion regardless of
   graph size/box size; combined with a weak forceLink on high-degree edges,
   charge can dominate and push a linked node away with nothing strong enough
   pulling it back except the deliberately-weak 0.05 center pull (which pulls
   toward the GLOBAL centroid, not toward the specific neighbor) — a
   plausible mechanism for "stranded far from its neighbor."
3. `D3_FORCE_COLLIDE_PADDING_PX` / `D3_FORCE_LINK_GAP_PX` (both 20-40px) only
   affect minimum spacing, not attraction, so they are unlikely root causes
   for "stranded" nodes but do inflate `forceLink.distance()` (collide radius
   of both endpoints + 40px gap) — worth checking whether distance() is
   unexpectedly large for big folder-group containers (whose collideRadius =
   hypot(width,height)/2 + 20, and containers can be much larger than plain
   leaf nodes), which combined with a weak link strength could produce very
   long resting edges even without a "bug," just insufficient pull.
4. No existing quantitative test asserts on edge length or crossing count —
   only overlap-freedom (`overlappingPairCount`) and determinism are checked.
   A fix will need a NEW metric-based test (e.g. max/average edge length
   relative to node sizes, or crossing count) built on the
   `D3ForceLayout.test.ts` `laidOutBoxes` pattern to prove regression-free
   improvement.
