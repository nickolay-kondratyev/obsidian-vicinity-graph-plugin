# Exploration: intra-group node placement + group box sizing (compact-group-layout)

Repo: obsidian-vicinity-graph-plugin. All paths repo-relative.

## 1. Responsible files/functions

### Pipeline order (per rebuild)
```
engine (VicinityEngine, NodeSizer) → GraphNode[] with sizePx/title
  → src/view/elkMapping.ts: vicinityGraphToElk()      [build elk input tree]
  → src/view/GraphLayoutRunner.ts: layout()            [elk.layout() then maybe d3 refine]
      → src/view/ElkLayoutRunner.ts                    [thin elkjs wrapper]
      → src/view/d3ForceRefinement.ts: refineForceRootLayout()  [only if root alg === "force"]
          → src/view/forceRectCollide.ts: forceRectCollide()    [AABB collision force]
  → src/view/elkMapping.ts: extractElkPositions(), extractElkDimensionsById()
  → src/view/flowMapping.ts: vicinityGraphToFlow(), withPositions(), withGroupDimensions()
  → React Flow render
```

### A. Intra-group node placement (inside one folder-group container)
- **File**: `src/view/elkMapping.ts`, `vicinityGraphToElk()` (lines 30-76). For each `FolderGroup` (from `deriveFolderGroups`), builds an elk container node: `{ id: folderGroupIdOf(folder), children: <member leaf ElkNodes>, edges: <intra-group edges>, layoutOptions: elkGroupMemberOptions(nodeSpacingPx) + elk.padding }`.
- **Algorithm constants**: `src/view/constants.ts` `elkGroupMemberOptions()` (lines 133-139) — `elk.algorithm = "layered"`, `elk.direction = "DOWN"` (top-to-bottom rows), `elk.spacing.nodeNode = nodeSpacingPx` (user setting, see below). This is elk's classic layered/Sugiyama algorithm run independently per container (elk's default `SEPARATE_CHILDREN` hierarchy handling under the root's `force` algorithm — `force`/`stress` do not support `INCLUDE_CHILDREN`, only `layered` does).
- No custom grid/column code exists for intra-group placement — it is 100% delegated to elkjs's layered algorithm with only 2 tunables (direction, node-node spacing) and a padding box. No column-count or row-count heuristic is set explicitly, so elk's own layered defaults decide wrapping/row breaks (unconfigured further in this repo).
- Container's own size is NOT computed by this repo's code — it's elk's built-in "container wraps its laid-out children" behavior (`extractElkDimensionsById()` in `elkMapping.ts` lines 157-170 just reads elk's own `width`/`height` back off the container node after layout).

### B. Group box sizing/padding
- **Padding**: `src/view/constants.ts`:
  - `GROUP_SIDE_PADDING_PX = 16` (line 150) — left/right/bottom inset of members from container border. Documented as a measured CEILING tied to edge-routing clearance (changing it can break `edgeRouting.test.ts` assumptions — see §4 "SWEEP__PUBLIC.md §4").
  - `GROUP_TOP_PADDING_PX = 36` (line 156, private) — extra top inset reserved for the rendered folder-name label.
  - `ELK_GROUP_PADDING` (lines 158-167) — assembles both into elk's `ElkPadding` string syntax `[top=36.0,left=16.0,bottom=16.0,right=16.0]`, passed as `elk.padding` layout option on each group container in `vicinityGraphToElk()`.
- **Member spacing inside a group**: `elk.spacing.nodeNode` = `ViewSettings.forceLayout.elkNodeSpacingPx` — default 40px, range 10-120 step 5 (`src/engine/SettingsSpec.ts` line ~269). This single setting ("Group member spacing" in Settings UI) feeds BOTH the intra-group elk pass and the root force-seed spacing (`elkForceRootOptions()`).
- **Container final size**: elk computes it as whatever the layered algorithm + padding needs to fit all member boxes — no min/max size cap, no explicit "pack tightly" post-process. `withGroupDimensions()` in `src/view/flowMapping.ts` (lines 375-386) just copies elk's reported container width/height onto the React-Flow group node (originally a `UNSIZED_GROUP_PX = 0` placeholder before layout, line 159).
- Membership rule that decides whether a folder gets a box at all: `src/view/folderGrouping.ts` `deriveFolderGroups()` — vault-root folder never groups; a folder groups only at `MIN_GROUP_MEMBER_COUNT = 2` (line 25) or more visible member nodes; singletons render as plain (ungrouped) nodes.

### C. Group-to-group (root-level) placement
- **Seed pass**: `src/view/elkMapping.ts` `vicinityGraphToElk()` root object — `layoutOptions: elkForceRootOptions(nodeSpacingPx)` (constants.ts lines 109-114): `elk.algorithm = "force"`, `elk.spacing.nodeNode = nodeSpacingPx` (same "Group member spacing" knob). Elk's own force algorithm gives a rough untangled arrangement AND (as a side effect of `SEPARATE_CHILDREN`) sizes each folder container from its internal layered layout — it does not repack containers tightly.
- **Refinement pass** (the one that actually matters for root packing): `src/view/d3ForceRefinement.ts` `refineForceRootLayout()` (whole file, ~140 lines). Runs a static (non-animated) d3-force simulation over the root's direct children only (folder-group containers + ungrouped leaf notes), treating each as a rigid rectangular body (elk-computed size, immutable during this pass — children's *internal* layouts are untouched):
  - `forceLink` — spring between linked bodies; resting distance = `minHalfExtent(source) + minHalfExtent(target) + forceLayout.linkGapPx` (default `linkGapPx = 40`, range 10-250); strength = `linkStrengthFactor / min(linkCount(source), linkCount(target))` (default `linkStrengthFactor = 1`, range 0.25-4).
  - `forceManyBody` (charge) — global repulsion, strength `-forceLayout.repelStrength` (default 300, range 50-1000; negated because d3 repels on negative strength).
  - `forceRectCollide` (custom, `src/view/forceRectCollide.ts`) — AABB (axis-aligned rectangle) collision, NOT d3's circular `forceCollide`, run `D3_FORCE_COLLIDE_ITERATIONS = 2` passes/tick (`constants.ts` line 124); padding = `forceLayout.collidePaddingPx` (default 50, range 0-100) added once per colliding pair.
  - `forceX`/`forceY` centering pull toward origin, strength `forceLayout.centerPullStrength` (default 0.05, range 0-0.15).
  - Deterministic: fixed-seed LCG replaces `Math.random` (`seededRandom()`, lines 128-140); tick count = `ceil(log(alphaMin)/log(1-alphaDecay))` (d3's static-layout recipe).
  - Only runs when `graph.layoutOptions["elk.algorithm"] === "force"` (checked in `GraphLayoutRunner.layout()`), i.e. always for the current root config, and only when there are >= 2 root children (`children.length < 2` early-return, line 36-38).
- This C4/C1 replaced d3's circular `forceCollide` specifically because a tall/wide folder box's circumscribing circle stranded neighbours far off its diagonal (documented ticket-03 regression, comments in `d3ForceRefinement.ts` lines 22-26).

## 2. All constants involved

| Constant | Value | File:line | Role |
|---|---|---|---|
| `MIN_GROUP_MEMBER_COUNT` | 2 | `src/view/folderGrouping.ts:25` | Min members for a folder to render as a group box |
| `GROUP_SIDE_PADDING_PX` | 16 | `src/view/constants.ts:150` | Group container left/right/bottom inset (elk padding), also the edge-routing clearance ceiling |
| `GROUP_TOP_PADDING_PX` | 36 (private) | `src/view/constants.ts:156` | Group container top inset (room for folder-name label) |
| `ELK_GROUP_PADDING` | derived string | `src/view/constants.ts:165-167` | Assembled `elk.padding` value passed to each container |
| `ELK_DIRECTION` | `"DOWN"` | `src/view/constants.ts:88` | Primary layout axis inside a group (elk layered) |
| `ELK_FORCE_ALGORITHM` | `"force"` | `src/view/constants.ts:96` | Root algorithm marker |
| `D3_FORCE_COLLIDE_ITERATIONS` | 2 | `src/view/constants.ts:124` | Rect-collide relaxation passes/tick (root refinement only) |
| `ForceLayoutSettings.elkNodeSpacingPx` | default 40, range 10-120 step 5 | `src/engine/SettingsSpec.ts:~269` | "Group member spacing" — feeds BOTH intra-group `elk.spacing.nodeNode` and root force-seed spacing |
| `ForceLayoutSettings.linkGapPx` | default 40, range 10-250 step 5 | `SettingsSpec.ts:~247` | d3 link resting-distance gap (root pass only) |
| `ForceLayoutSettings.collidePaddingPx` | default 50, range 0-100 step 5 | `SettingsSpec.ts:~259` | Rect-collide padding between root boxes |
| `ForceLayoutSettings.repelStrength` | default 300, range 50-1000 step 10 | `SettingsSpec.ts:~220` | Root charge-force magnitude |
| `ForceLayoutSettings.centerPullStrength` | default 0.05, range 0-0.15 step 0.01 | `SettingsSpec.ts:~209` | Root centering pull |
| `ForceLayoutSettings.linkStrengthFactor` | default 1, range 0.25-4 step 0.05 | `SettingsSpec.ts:~235` | Root link-spring strength multiplier |
| `NODE_TITLE_CHAR_WIDTH_PX` | 7 | `src/view/constants.ts:48` | Glyph-width heuristic for node width |
| `NODE_LABEL_HORIZONTAL_PADDING_PX` | 20 | `src/view/constants.ts:51` | Node width chrome (padding+border) |
| `NODE_MAX_LABEL_WIDTH_PX` | 250 | `src/view/constants.ts:60` | Cap on label-driven node width |
| `THUMBNAIL_VISIBLE_MIN_NODE_PX` | 104 + 18 = 122 | `src/engine/constants.ts:84-112` | Floor height for image-bearing nodes |
| `CENTRAL_SIZE_SCORE` | 1 | `src/engine/constants.ts:73` | Centrals get max score → maxPx |
| `SizingSettings.minPx` / `maxPx` | defaults from `SETTINGS_SPEC.globalView.sizing` | `src/engine/SettingsDefaults.ts:25-26` | Node height range (score-mapped) |
| `SIZE_RELAYOUT_THRESHOLD` | 1.0 (+100%) | `src/view/constants.ts:20` | Growth fraction that forces a full relayout instead of data-only refresh |

There are NO column-count / row-count / grid-cell-size constants anywhere in the codebase — grid arrangement (if any) is entirely elk-layered's internal decision, unconfigured beyond direction + node spacing.

## 3. Node size origin — dynamic, per-node

Node HEIGHT = `GraphNode.sizePx`, computed in `src/engine/NodeSizer.ts` `computeSizes()`:
- Centrals (MAIN + pinned) bypass scoring → `CENTRAL_SIZE_SCORE = 1` → `maxPx`.
- Others: a weighted composite score in [0,1] from enabled/weighted metrics (registry in `enabledWeightedMetrics()`, lines 114-128): `own-file-size` (log1p bytes), `total-linker-size` (log1p sum of incoming linkers' bytes), `backlink-count`, `outlink-count` (node-bearing only), `depth-decay` (`1/(1+k*minDepth)`). Score is min-max normalized per metric then weighted-averaged.
- `sizePx = minPx + score * (maxPx - minPx)`, then floored (never lowered) to `THUMBNAIL_VISIBLE_MIN_NODE_PX` (~122px) if the node has an image (`withImageSpace()`, lines 91-96), capped at settings `maxPx`.
- So yes: **backlink/outlink count (and file size, depth) directly drive per-node height**, and the sizes vary continuously per node, not from a fixed set of tiers.

Node WIDTH = computed in `src/view/graphIdentity.ts` `nodeDimensionsPx()` (lines 53-58): `max(sizePx, min(NODE_MAX_LABEL_WIDTH_PX, estimateNodeLabelWidthPx(title)))` — i.e. width floors at the (variable) height (square minimum) and grows with title length up to 250px, then the title wraps instead of widening further.

Net: **both node width and height are variable per node** — driven by link/size/depth metrics (height) and title length (width). Group-box layout must accommodate genuinely heterogeneous rectangle sizes, not a uniform grid cell.

## 4. Existing tests covering layout

- `src/view/ElkLayout.test.ts` — real elkjs, no d3. Asserts: every node gets a position; two elk-laid-out siblings don't overlap (exact-equality check only, not real overlap detection); layout is deterministic across repeated runs; for a folder-grouped fixture, the container's elk-reported dimensions strictly exceed a single 100px member (width) and are `>=` a member (height); the container AND its members all receive positions; members inside a container don't land at exactly the same position.
- `src/view/D3ForceLayout.test.ts` — full pipeline (elk seed + d3 refine) via `GraphLayoutRunner`. Key fixture: a 160px hub with 24 neighbours (80px each), half-incoming/half-outgoing links (the "motivating case" from the ticket-03 stranding bug). Asserts: every node positioned; **zero AABB-overlap pairs** (`countOverlappingAabbPairs`, real rectangle-overlap check, not just inequality) despite mixed link directions; determinism across repeated runs. Second describe block: a grouped fixture confirms the container still wraps its 2 members after the FULL pipeline (elk+d3), everyone gets a position, and — importantly — **members stay strictly INSIDE the container's box** (`member.x >= container.x && ... x+100 <= container.x+dims.width`, same for y) — i.e. the root-level d3 refinement does not blow the group interior open.
- `src/view/elkMapping.test.ts` (210 lines, not fully read but present) — presumably unit-tests `vicinityGraphToElk`'s tree construction (container/child/edge shape), `extractElkPositions`, `extractElkDimensionsById` at the mapping level (no real elkjs engine, pure structure).
- `src/view/folderGrouping.test.ts` (98 lines) — unit tests `deriveFolderGroups()`: 2+ member threshold, root-folder exclusion, determinism, `groupFolderByMemberPath` correctness.
- `src/engine/NodeSizer.test.ts` — sizing score/pixel computation, image-floor behavior, centrals bypass.
- `src/view/edgeRouting.test.ts` — NOT a layout-sizing test per se, but explicitly locks `GROUP_SIDE_PADDING_PX` as a ceiling relative to edge-routing clearance (referenced in constants.ts comment at line 148, "edge-routing__06 `SWEEP__PUBLIC.md` §4"), so shrinking group padding without checking this test/doc risks breaking routing-clearance assumptions.
- No test directly measures "wasted space" / bounding-box area efficiency / packing density inside a group — all existing assertions are overlap-freedom, containment, and determinism, not compactness.

## 5. Docs describing layout design

- `docs-internal/architecture-map.md` (lines ~59-66): one-paragraph summary — elkjs hierarchical/compound layout, root `force` seed + `layered` for group members, d3-force root refinement, structural-diff-gated relayout with `SIZE_RELAYOUT_THRESHOLD`.
- `docs-internal/plan/high-level-plan.md`: product-level context only — grouping is a headline feature ("Grouping by folder... visible structure, not invisible metadata"), elkjs chosen because it (unlike Dagre) understands compound/hierarchical layout, folder groups render only at 2+ members (line 102), structural-diff relayout policy (lines 110-112). No algorithmic detail on intra-group packing.
- `docs-internal/research/research-layout-aesthetics.md` — the most relevant design doc, though it is framed around **edge-routing aesthetics**, not raw spacing efficiency. Directly documents the "wasted interior" mechanism (their **P4**, §B2): elk `layered` lays out each group with **zero knowledge of the outside world** (`SEPARATE_CHILDREN`), so it produces "a wide, mostly-empty box whose hub member sits in the far corner" — every intra-group edge crosses empty middle space, and the box presents an oversized obstacle face externally. Proposes but has **not implemented**:
  - **C3 "Group orientation pass"** (~1 week): after d3 settles root positions, try 8 axis-aligned symmetries of each group's internal layout (or re-run `elk.direction` toward the external-neighbour centroid) and pick the variant minimizing external edge length — pure math, no wasm, fully unit-testable, not yet built.
  - **C4 "Members join the force simulation"** (medium-large, deeper fix): group members participate in the SAME d3 simulation as everything else with containment forces; group rect computed AROUND settled members afterward (yFiles `GroupNodeHandlingPolicy.FREE` precedent). This is the most direct answer to "compact packing" but is un-built.
  - Notes elk's own `stress`/`force` do NOT support `INCLUDE_CHILDREN` (only `layered` does), so today's structural split (layered-inside / force-outside) is closer to a hard constraint of the library than a deliberate choice — a genuine fix requires either abandoning `SEPARATE_CHILDREN` (accepting elkjs's documented cross-hierarchy rough edges, issues #159/#112/#26) or building custom logic outside elk (C3/C4).

## 6. Sources of "spread out" / wasted space (concrete, code-grounded)

1. **Group interior sizing has no compactness objective.** `elk.layered` inside each container (`elkGroupMemberOptions`) only receives `elk.direction=DOWN` and `elk.spacing.nodeNode`; there is no `aspectRatio`, no target width/columns, so for N heterogeneous-size members elk's layered algorithm can produce a tall/wide box shaped however its internal Sugiyama heuristic happens to lay rows out — verified in the ElkLayout test only checking width/height `> 100`, no check on efficiency.
2. **`elk.spacing.nodeNode` is a single global gap knob** (`elkNodeSpacingPx`, 10-120px) applied uniformly between every member pair regardless of their actual sizes — larger nodes still get the same fixed gap as smaller ones, so gap-to-node-size ratio varies a lot as sizePx ranges from `minPx` to `maxPx` (default range not fixed but commonly tens to 160px), and the same knob is reused for the totally different root-level spacing concept (documented as deliberate "one spacing concept," `constants.ts` line ~105-107) — so tuning one necessarily tunes the other.
3. **Group padding is fixed and asymmetric regardless of content**: 16px on 3 sides + 36px reserved on top for the label, on EVERY group container no matter how many members or how tightly they already pack — for small 2-member groups this fixed overhead is a larger fraction of the box.
4. **No orientation/repacking pass exists yet** (research doc's C3/C4, unimplemented): group interiors are computed once, independent of the rest of the graph, and never revisited even though the root-level d3 pass moves the whole box around — so a hub member can end up in the box's far corner from its external neighbours, forcing longer edges and making the box's visual footprint (and its collision "shadow" in the root force pass) bigger than the members' own bounding area would require.
5. **Root-level box separation uses a flat `collidePaddingPx` (default 50) as fixed padding between EVERY pair of root-level boxes** (groups + ungrouped leaves alike, `forceRectCollide`), so once elk grows a group's box to fit a wide layered arrangement (see #1), the whole oversized rectangle also inflates the effective free space demanded from its root-level neighbours — inefficiency compounds from container step into the outer layout step.
6. **`minHalfExtent()` reasoning in `d3ForceRefinement.ts`** (root link resting distance) explicitly reasons about a box's SMALLER half-extent to avoid stranding (documents the diagonal-vs-side ticket-03 bug) — a sign the team already treats box shape irregularity (tall/thin vs. wide/short groups) as a known source of extra empty space in the surrounding layout, not just inside the group.
7. Elk's hierarchy handling forces `SEPARATE_CHILDREN` because the root uses `force` (neither `force` nor `stress` supports `INCLUDE_CHILDREN`) — this is a structural constraint, not a tunable, meaning any "compact packing that reacts to the whole graph" fix needs either a custom pass bolted on afterward (the research doc's C3/C4) or switching away from elk's force root altogether.

## Planner/implementer quick pointers

- To change intra-group packing algorithm/heuristics: edit `elkGroupMemberOptions()` in `src/view/constants.ts` (elk options) and/or the container construction in `vicinityGraphToElk()` (`src/view/elkMapping.ts`) — e.g. add `elk.aspectRatio`, switch `elk.algorithm` for containers, or post-process container children positions after elk runs (before `extractElkPositions`).
- To change group box padding: `GROUP_SIDE_PADDING_PX` / `GROUP_TOP_PADDING_PX` / `ELK_GROUP_PADDING` in `src/view/constants.ts` — **check `src/view/edgeRouting.test.ts` and the edge-routing__06 doc before shrinking `GROUP_SIDE_PADDING_PX`**, it is load-bearing for routing clearance.
- To change root-level (group-to-group) placement: `src/view/d3ForceRefinement.ts` (forces/parameters) and `src/view/forceRectCollide.ts` (collision shape/algorithm); tunables surface as `ForceLayoutSettings` in `src/engine/SettingsSpec.ts`.
- To implement the doc-proposed compaction fixes (C3 orientation pass / C4 members-in-simulation): new code, no existing hook — would sit between `GraphLayoutRunner.layout()`'s elk pass and its d3 pass (C3), or replace/extend `refineForceRootLayout()` to also move group MEMBERS, not just container boxes (C4), then recompute container bounding box from settled member positions (would need new dimension-recompute logic; today `extractElkDimensionsById` only reads elk's own numbers).
- Node width/height are dynamic per node (`NodeSizer.ts`, `graphIdentity.ts` `nodeDimensionsPx()`) — any new packing algorithm must handle heterogeneous rectangle sizes, not assume a uniform grid cell.
