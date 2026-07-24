# IMPLEMENTATION — PRIVATE rehydration notes (03 force placement quality)

## Outcome
BLOCKED / escalated. Tree pristine (no src or test changes committed/left). See
IMPLEMENTATION__PUBLIC.md for the human-facing escalation + `#QUESTION_FOR_HUMAN`.

## The one-sentence finding
The Enchiridion stranding is caused by the **circular `forceCollide` using the
folder-group container's circumscribed-circle radius** (`hypot(w,h)/2 + 20`); the
`p/ep` container is 192×392 (two 160px members stacked by elk layered DOWN) → radius
~238px → every external neighbour of the buried hub is pushed ~238px+ from the
container centre at uneven angles. Charge and link-strength are irrelevant to it.

## Hard numbers (real elk+d3 pipeline, deterministic)
- Degree-1 leaf always rests at ratio ≈ 0.94–0.98 (link strength=1 dominates). Only
  strands (>1) at crowd≥16, and THAT is collide-ring geometry (charge-invariant).
- Charge sweep −300→−30: `overallMax` identical to 3 dp (1.234 @crowd16, 1.317
  @crowd24). Proof charge has zero leverage on the stretch metric.
- grouped vs ungrouped hub: ench→hub 375 vs 247; crowdToHub uneven
  [332,261,414,417,288] vs tidy [245,244,241,242,243]. Proof the container is the
  culprit.
- Lever 4 dead: circular collide already forbids center-distance < sum of
  circumscribed radii, so shrinking only link distance does nothing; shrinking
  collide → box overlaps → fails `overlappingPairCount==0`.

## Dead ends (do not repeat)
- strandedHubGraph small crowd (4–12): no stranding to fix.
- strandedHubGraph large crowd (16–24): fails, but charge-invariant, not fixable by
  Levers 1–2; also a collide-geometry false-positive, not the Enchiridion.
- twoClusterGraph (competing cluster): leaf rests ~0.94 for all charge; useless.
- Charge reduction (−160/−180 etc.): does NOT move the metric. Confirmed thrice.
- Lever 1 (pin strength=1): no-op on all hub-spoke fixtures (all degree-1).

## Where the real fix must go (for whichever direction the human picks)
- `src/view/d3ForceRefinement.ts`:47 `collideRadius = hypot(w,h)/2 + PADDING` and
  :71 `forceCollide(body=>body.collideRadius)` — the circular over-approximation.
  Option 1 (AABB collide) replaces this force. Option 3 (cap radius) tweaks it.
- `src/view/elkMapping.ts`:86 `projectedRootEdges` projects cross-boundary edges onto
  the container id. Option 2 (attract to member note, not container centre) touches
  this + the link setup in d3ForceRefinement.
- Container tallness originates in `ELK_GROUP_MEMBER_OPTIONS` (elk.direction=DOWN),
  constants.ts:120.

## Reusable investigation harness
Full copy at `.tmp/investigation-harness.test.ts.txt` (ephemeral). The durable,
essential pieces to paste back into `src/view/D3ForceLayout.test.ts` next time:

```ts
// imports to add:
//   import { D3_FORCE_COLLIDE_PADDING_PX, D3_FORCE_LINK_GAP_PX } from "./constants";
//   import type { ElkNode } from "elkjs";

const STRANDED_HUB_FOLDER = "p/ep";
const STRANDED_BOOK_FOLDER = "p/ep/book";
const crowdPath = (i: number): string => `crowd${i}.md`;

function strandedHubGraph(crowdCount = 5): VicinityGraph {
  const crowd = Array.from({ length: crowdCount }, (_, index) =>
    makeNode({ path: asVaultPath(crowdPath(index)), minDepth: 1, sizePx: NEIGHBOR_SIZE_PX }),
  );
  return makeGraph({
    nodes: [
      makeNode({ path: asVaultPath("main.md"), isCentral: true, isMain: true, minDepth: 0, sizePx: 100 }),
      makeNode({ path: asVaultPath("p/ep/hub.md"), folder: asFolderPath(STRANDED_HUB_FOLDER), minDepth: 1, sizePx: HUB_SIZE_PX }),
      makeNode({ path: asVaultPath("p/ep/sib.md"), folder: asFolderPath(STRANDED_HUB_FOLDER), minDepth: 1, sizePx: HUB_SIZE_PX }),
      ...crowd,
      makeNode({ path: asVaultPath("p/ep/book/enchiridion.md"), folder: asFolderPath(STRANDED_BOOK_FOLDER), minDepth: 2, sizePx: NEIGHBOR_SIZE_PX }),
    ],
    edges: [
      makeEdge("main.md", "p/ep/hub.md"),
      makeEdge("p/ep/hub.md", "p/ep/sib.md"), // intra-group ⇒ container
      ...crowd.map((n) => makeEdge("p/ep/hub.md", n.path)),
      makeEdge("p/ep/hub.md", "p/ep/book/enchiridion.md"), // degree-1 leaf
    ],
  });
}

// Metric over the PROJECTED root edges (what forceLink actually acts on):
async function edgeStretches(graph: VicinityGraph) {
  const elkRoot = vicinityGraphToElk(graph);
  const laidOut = await new GraphLayoutRunner().layout(elkRoot);
  const positions = extractElkPositions(laidOut);
  const dimensions = extractElkDimensionsById(laidOut);
  const collideRadiusOf = (id: string) => {
    const d = dimensions.get(id)!;
    return Math.hypot(d.width, d.height) / 2 + D3_FORCE_COLLIDE_PADDING_PX;
  };
  const centerOf = (id: string) => {
    const p = positions.get(id)!; const d = dimensions.get(id)!;
    return { x: p.x + d.width / 2, y: p.y + d.height / 2 };
  };
  return (elkRoot.edges ?? []).map((edge: NonNullable<ElkNode["edges"]>[number]) => {
    const s = edge.sources[0] as string; const t = edge.targets[0] as string;
    const cs = centerOf(s); const ct = centerOf(t);
    const target = collideRadiusOf(s) + collideRadiusOf(t) + D3_FORCE_LINK_GAP_PX;
    return { source: s, target: t, ratio: Math.hypot(cs.x - ct.x, cs.y - ct.y) / target };
  });
}
```

NOTE if a fix lands: this circumscribed-normalised metric will still read ~1 for the
inflated placement (it normalises away the container size). For an AABB-collide fix
(option 1), assert on ABSOLUTE rendered leaf→member distance vs the tight-pack
baseline (e.g. `ench→hub` should approach the ungrouped ~247 rather than ~375), or
normalise by `max(halfW,halfH)` sums instead of the diagonal. Verify overlaps stay 0
on `hubGraph()` (24) after any collide change.
