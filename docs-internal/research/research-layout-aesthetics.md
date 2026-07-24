# Research: layout/routing aesthetics — why edges take odd routes

Triggered by the 2026-07-24 `clear-goals` dev-vault screenshot: Epictetus sits
directly LEFT of the folder-group box yet its edge wraps around and attaches at
the group's BOTTOM; long edges cross the group's empty interior; crossings
abound. This note documents (A) how the current pipeline actually behaves, (B)
the root-cause diagnosis of each symptom, and (C) researched fixes ranked by
ROI, with sources (D).

Problem index used throughout:
**P1** roundabout/wrap-around attachment · **P2** many crossings ·
**P3** shared parallel corridors · **P4** group interior blind to external
neighbours · **P5** no layout↔routing feedback loop.

## A. The current pipeline (verified in code)

```
engine graph
  → vicinityGraphToElk            (elkMapping.ts)
      root: elk `force` (seed only), SEPARATE_CHILDREN
      group interiors: elk `layered`, direction DOWN
      cross-boundary edges PROJECTED onto group containers (layout hints only)
  → GraphLayoutRunner.layout
      elk pass, then refineForceRootLayout (d3ForceRefinement.ts)
      moves ONLY root-level boxes (groups = opaque rectangles)
  → resolveRoutes                 (GraphViewController.ts)
      libavoid PolyLine routing (edgeRouting.ts):
        shapeBuffer 17px, segmentPenalty 50, crossingPenalty 0 (perf-disabled)
        group boxes: 12 boundary pins; note squares: 1 centre pin
      clipRouteToEndpointRects → arrow terminates on the border
  → publish → React Flow render
```

Key property: **the pipeline is strictly one-directional.** Layout finishes,
then routing copes with whatever geometry it is handed. No step feeds routing
pain (detours, wraps, crossings) back into placement. Notably, the research
pass found this is industry-standard: even yFiles ships layout → routing as
sequential stages — the true co-optimizers (Adaptagrams libtopology / Dunnart)
never made it to mainstream tooling. So P5 is a ceiling-raiser, not a defect.

## B. Root-cause diagnosis per symptom

### B1 → P1. Epictetus wrap-around attachment (the headline symptom)

Routing IS active in the screenshot (rounded routed corridors hugging the
group's left border are visible). The wrap happens because:

1. The group's 12 boundary pins share one class with **equal cost**; libavoid
   picks the cheapest *path*, not the facing *side*. With `crossingPenalty = 0`
   a long wrap costs almost nothing extra.
2. The corridor between Epictetus and the group's left border is crowded
   (other note squares, each with a 17px shape buffer), so left-side pins are
   expensive/unreachable → the router detours to a bottom pin.
3. Note squares have a single `ConnDirAll` **centre** pin, so the counterpart
   end is side-agnostic too.
4. Nothing re-examines the result: detour ratio ≫ 1 is *logged*
   (`detourStats`) but never acted on.

### B2 → P4. Long edges crossing the group's EMPTY interior

The group interior is laid out by elk `layered` (direction DOWN) with **zero
knowledge of the outside world** (`SEPARATE_CHILDREN`): four source-members
form a wide top row, Clear Goals lands below-right (barycenter under Success).
Result: a wide, mostly-empty box whose hub member sits in the far corner —
every intra-group edge crosses the empty middle, and the box presents a huge
obstacle face to external routes. The projected root edges steer only WHERE
the box goes, never HOW its interior is oriented, and elk has **no option** to
rotate/reflect a separately-laid-out child toward its external neighbours
(verified against the full options reference). elk `force`/`stress` do not
support `INCLUDE_CHILDREN` — only `layered` does — so the current force root
can structurally never see cross-hierarchy edges.

### B3 → P2, P3. Crossings and shared corridors

- `crossingPenalty = 0` (deliberate: edge-routing__03 measured ~1700ms at 100
  vs ~140ms at 0 on the dense fixture, main thread).
- libavoid's entire nudging/shared-path machinery
  (`idealNudgingDistance`, `nudgeOrthogonalSegmentsConnectedToShapes`,
  `fixedSharedPathPenalty`, …) is **orthogonal-mode only**; in the current
  PolyLine mode P3 has essentially no native remedy.
- d3-force optimizes distances only; force-directed layouts do not minimize
  crossings, and no post-pass does either.

### Evidence-based priority (Purchase et al.)

Empirical graph-drawing studies rank **edge crossings as by far the most
important aesthetic** for comprehension, bends second; edge-length uniformity
and angular resolution are measurably weak. So P2 ≥ P1 > P3, and
`crossingPenalty = 0` is the single most evidence-contradicted knob in the
stack. Length-uniformity work (stress vs spring) is NOT worth effort yet.

## C. Options, ranked by ROI

2026-07-24 disposition: the facing-side attachment work (C1 minus its
crossing-penalty items) is ticketed as `edge-routing__05`
(nid_4lmhpfc64eb4auw27wqis8wqe_e). Crossing penalty + worker offload (C2 and
C1's penalty items) are PARKED — findings preserved in
`../research/crossing-penalty-and-worker-offload.md`, deliberately not ticketed.

### C1. Side-aware pins + costs + cluster penalties (P1, P2, part P3) — days, parameter-level

All on the libavoid API we already ship:

- Keep directional boundary pins on groups, but **cheapen the facing side**:
  `ShapeConnectionPin.setConnectionCost(cost)` — among same-class pins, lower
  cost wins before raw path cost. Facing side is computable from the two
  endpoint rects before routing.
- Make pins **exclusive** (`setExclusive(true)`; directional pins are
  exclusive by default) — one connector per pin spreads attachments along the
  border instead of piling into one corridor.
- Replace the note-square centre pin with **4 directional side pins** so
  libavoid picks the facing side on that end too (12-pins-per-note was the
  perf blowup in edge-routing__04; 4 is the middle ground to re-measure).
- Re-enable a **small `crossingPenalty`** (see C2 for the perf story) and add
  `portDirectionPenalty` so wrong-direction pin approaches cost extra.
- Register group boxes as `Avoid::ClusterRef` and set
  `clusterCrossingPenalty` so routes slicing across group boundaries pay.

Fallback lever if pin costs underdeliver: post-check any clipped route with
`detourRatio > THRESHOLD`, re-route once with pins restricted to the facing
side, keep the shorter.

### C2. Worker offload → affordable penalties (P2) — medium

The perf reason for `crossingPenalty = 0` is the main-thread budget. Moving
the routing pass to a **web worker** (already deferred in edge-routing__03)
makes a modest crossing penalty affordable; routes publish asynchronously
(straight → routed swap, like today's lazy wasm load). Given Purchase's
evidence, this unblocks the highest-value aesthetic.

### C3. Group orientation pass (P4) — ~1 week, custom code

After d3 settles root positions, per group: try the 8 axis-aligned symmetries
(4 rotations × mirror) of the internal layered layout — optionally also re-run
the internal layout with `elk.direction` facing the external-neighbour
centroid — and pick the variant minimizing Σ external edge length. Pure math,
deterministic, O(groups × 8 × external edges), fully unit-testable without
wasm. No library ships this; the precedent is HOLA's decompose-trees-and-
reattach-with-chosen-orientation stage.

### C4. Members join the force simulation (P4, deeper fix) — medium-large

The yFiles OrganicLayout precedent (`GroupNodeHandlingPolicy.FREE`): group
**members participate in the same simulation** as everything else, with
per-group containment forces; the group rect is computed AROUND the settled
members. Cross-group links then naturally pull a hub member toward the side
its neighbours are on — the structural fix for P4. Could be built on the
existing d3 stage (custom containment force + recompute group rects) without
new dependencies. Alternative: one `elk.layered` + `INCLUDE_CHILDREN` run
with FIXED_SIDE ports — fixes P4 but abandons the organic look, and elkjs
issue history (#159, #112, #26) flags cross-hierarchy rough edges.

### C5. Orthogonal routing mode (P3 properly) — days + a style decision

Switching libavoid PolyLine → Orthogonal unlocks the designed shared-corridor
fixes: `idealNudgingDistance`, `nudgeOrthogonalSegmentsConnectedToShapes`,
`fixedSharedPathPenalty`, `penaliseOrthogonalSharedPathsAtConnEnds`. Proven
in-browser precedent: `sprotty-routing-libavoid`. Changes the visual language
(right-angle circuits vs organic lines) — a deliberate design call.

### C6. Poor-man's feedback loop (P5) — ~1–2 weeks

Iterate route → measure (detour ratio, already computed) → nudge/flip
offenders → re-route, 2–3 rounds. Cheap at 30–100 nodes. The full version —
topology-preserving constrained layout (Adaptagrams libtopology/libdialect) —
has **no JS/WASM port**; compiling one ourselves is weeks plus toolchain
ownership. WebCola has constrained stress + groups but no libtopology and is
dormant (last release 2019). Keep as a far-horizon ticket.

### C7. Not recommended

- **Edge bundling (FDEB)**: deliberately merges edges into ambiguous
  corridors — worsens P3's traceability at vicinity scale.
- **Stress-majorization swap of the d3 stage**: better length uniformity, but
  that aesthetic ranks low (Purchase); cheap variant if ever wanted: seed with
  `elk.stress` instead of `elk.force` (same bundle, no new dependency).

## D. Sources

- Adaptagrams / libtopology / Dunnart / HOLA / libdialect:
  <https://www.adaptagrams.org/> · <https://github.com/mjwybrow/adaptagrams> ·
  <https://www.adaptagrams.org/documentation/libtopology.html> ·
  Dwyer–Marriott–Wybrow GD'08 <https://users.monash.edu/~mwybrow/papers/dwyer-gd-2008-1.pdf> ·
  HOLA (TVCG 2016) <https://marvl.infotech.monash.edu/~dwyer/papers/hola2015.pdf> ·
  <http://www.adaptagrams.org/documentation/libdialect.html>
- libavoid API: Router <https://www.adaptagrams.org/documentation/classAvoid_1_1Router.html> ·
  ShapeConnectionPin <https://www.adaptagrams.org/documentation/classAvoid_1_1ShapeConnectionPin.html> ·
  ConnEnd <https://www.adaptagrams.org/documentation/classAvoid_1_1ConnEnd.html> ·
  HyperedgeRerouter <https://www.adaptagrams.org/documentation/classAvoid_1_1HyperedgeRerouter.html> ·
  browser precedent <https://github.com/Aksem/sprotty-routing-libavoid>
  (thesis <https://model-engineering.info/publications/theses/thesis-hnatiuk.pdf>) ·
  <https://github.com/MrMint/elkjs-libavoid>
- ELK: hierarchyHandling <https://eclipse.dev/elk/reference/options/org-eclipse-elk-hierarchyHandling.html>
  (INCLUDE_CHILDREN = layered only; force/stress lay out levels separately) ·
  overview paper <https://arxiv.org/pdf/2311.00533> ·
  portConstraints <https://eclipse.dev/elk/reference/options/org-eclipse-elk-portConstraints.html> ·
  contentAlignment (alignment only, no orientation) <https://eclipse.dev/elk/reference/options/org-eclipse-elk-contentAlignment.html> ·
  elkjs cross-hierarchy issues #159 #112 #26
- WebCola (libcola only, dormant since 2019): <https://github.com/tgdwyer/WebCola>
- Aesthetics evidence: Purchase GD'95 <https://link.springer.com/chapter/10.1007/BFb0021827> ·
  Purchase AUIC 2010 <https://www.cs.auckland.ac.nz/~beryl/publications/AUIC%202010%20Graph%20drawing%20aesthetics.pdf> ·
  survey <https://eprints.gla.ac.uk/227646/1/227646.pdf>
- Comparators: yFiles organic layout + group handling
  <https://docs.yworks.com/yfiles-html/dguide/layout/organic_layout.html> ·
  organic routing (post-process, no feedback loop)
  <https://docs.yworks.com/yfiles-html/dguide/layout/organic_routing.html> ·
  Graphviz fdp `overlap=prism` + `splines=compound`
  <https://graphviz.org/docs/attrs/splines/> ·
  Obsidian native graph (d3-force in worker, straight edges, no groups)
  <https://forum.obsidian.md/t/understanding-the-graph-view-core/41020>
- Edge bundling counter-evidence: FDEB impl <https://github.com/upphiminn/d3.ForceBundle> ·
  Edge-Path Bundling (ambiguity critique) <https://arxiv.org/pdf/2108.05467>

## E. Suggested sequencing

1. **C1** (side-aware/cost-weighted/exclusive pins, 4 side pins on notes,
   small crossingPenalty, ClusterRef) — parameter-level, attacks the two
   screenshot symptoms directly; re-measure the dense-fixture perf budget.
2. **C2** worker offload — makes the crossing penalty (the #1
   evidence-backed aesthetic) affordable for good.
3. **C3** orientation pass — the cheap, testable P4 fix that keeps the look.
4. **C4** members-in-simulation — the deeper P4 fix, if C3 underdelivers.
5. **C5** orthogonal mode — only if shared corridors still read poorly, as a
   deliberate visual-style decision.
6. **C6** feedback loop / libtopology — far-horizon research ticket.
