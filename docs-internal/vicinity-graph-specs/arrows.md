# Collapsing arrows to/from folder groups

## Question

When many notes inside a folder group (e.g. `thoughts` / "th") link to or from a
central node (e.g. `Epictetus`), the graph draws one arrow **per member**. The
result is a fan of near-parallel lines converging on the group box — visual
clutter with little added meaning. Can we **collapse** those into a **single
arrow between the node and the group**, without hacks?

**Verdict: yes — cleanly, and it follows a pattern the codebase already uses.**

## Why it is clean (not a hack)

The rendered edge set is produced by ONE pure function,
`vicinityGraphToFlow` (`src/view/flowMapping.ts`), which maps engine
`GraphEdge[]` → `FlowEdge[]`. Today every `FlowEdge` connects the two real note
endpoints, so a member-heavy group yields one line per member.

The exact transform we need — "project an endpoint that is a grouped member
onto its `folderGroupIdOf(folder)`, then dedupe" — **already exists** for the
layout side: `projectedRootEdges` in `src/view/elkMapping.ts` collapses
cross-boundary edges onto their containers and dedupes colliding pairs (it only
steers elk; React Flow draws its own edges from node positions). The ask is to
apply the same projection to the **rendered** edges. Reusing an established,
tested pattern is the opposite of a hack.

## Design

### 1. Collapse in `flowMapping` (the core change)

When `groupByFolder` is on, define the same projection the elk mapping uses:

```
projectId(path) = groupFolderByMemberPath.has(path)
                    ? folderGroupIdOf(folder)   // grouped member → its group box
                    : path                       // ungrouped note → itself
```

For each engine edge with `projSource = projectId(source)`,
`projTarget = projectId(target)`:

- **`projSource === projTarget`** → intra-group edge (both endpoints in the same
  box). This is NOT clutter — it lives inside the container. Keep it as the real
  member-to-member `FlowEdge`, unchanged. (Collapsing it would create a
  meaningless self-loop on the group.)
- **`projSource !== projTarget`** → cross-boundary edge. Collapse it.

**Union + bidirectional merge.** Accumulate collapsed edges keyed by the
**unordered** pair `{projSource, projTarget}`. For each pair track:
- whether `A→B` was seen, whether `B→A` was seen (direction union);
- the **summed** `count` of every contributing engine edge (multiplicity union).

Emit ONE `FlowEdge` per unordered pair:
- both directions seen → **bidirectional** (arrowhead at each end);
- one direction → single arrowhead at the target end;
- `count` = sum (the "×N" badge now means "N links collapsed into this arrow").

This is a pure, deterministic, node-testable change — same character as the rest
of `flowMapping`.

### 2. Group node must expose React Flow handles (prerequisite)

React Flow anchors an edge to a node's **handle**; the custom `VicinityEdge`
consumes the `sourceX/Y`, `targetX/Y` that RF derives from handle bounds.
`NoteNode` renders `<Handle type="target" Top>` + `<Handle type="source"
Bottom>` — but `FolderGroupNode` renders **none**, so an edge pointed at a group
id has nowhere to attach.

Fix: give `FolderGroupNode` the same pair of handles (visually hidden,
`isConnectable={false}`), exactly mirroring `NoteNode`. This is the idiomatic RF
way to make a node edge-addressable and is not a hack. (Groups stay
edge-connectable only; they remain non-interactive for links.)

### 3. Double-arrowhead for bidirectional edges

`edgeGeometry.edgePathFor` currently returns a single arrow anchor at the
target; `VicinityEdge` draws one `<polygon>`. Extend additively:

- `edgeGeometry` also returns a **source-side** anchor — the symmetric
  computation of the existing `arrowFromApproach`, using the reversed approach
  vector (inset back from the source along the outgoing tangent).
- `VicinityEdge` draws a second arrowhead polygon when the edge is bidirectional.

A bidirectional collapsed edge is drawn as a **single straight line with two
arrowheads**, per the request — no curve needed.

Note on the existing `hasOpposite` mechanism: today a note↔note A/B pair renders
as **two curved lines** that bow apart. The new double-arrowhead single line is
strictly clearer. Recommended (optional, for consistency/POLS): retire the
curved-pair rendering and use the one-line-two-arrowheads form for ALL
bidirectional edges, not only group-collapsed ones. This removes
`EDGE_PAIR_CURVATURE_PX` and the paired-curve branch. Scope it separately if we
want to keep this change minimal.

### 4. Layout modes — already consistent

Collapse is purely a render-set transform; RF draws edges from node positions,
so it works identically in `radial`, `force`, and `layered`. elk already
projects cross-boundary edges onto containers for layout in the
`SEPARATE_CHILDREN` modes, so layout and rendering now agree at the group
granularity instead of diverging.

## Edge cases to cover in tests

- Many members → one collapsed arrow; `count` = sum of member link counts.
- `A→member` and `otherMember→A` (opposite directions across the same group) →
  one bidirectional arrow (the union case the request calls out).
- Intra-group edges stay member-to-member (no group self-loop).
- `groupByFolder` off → behavior unchanged (no projection).
- A group with only cross-boundary links in ONE direction → single arrowhead.

## Effort / ROI

High ROI, contained blast radius. Three focused edits, all additive:
1. `flowMapping.ts` — projection + union/dedup (pure, the bulk of the value).
2. `FolderGroupNode.tsx` — add hidden handles (few lines, unblocks anchoring).
3. `edgeGeometry.ts` + `VicinityEdge.tsx` — second arrowhead (additive).

No engine changes: the collapse is a view concern. The pattern mirror to
`projectedRootEdges` keeps knowledge duplication low; the two could later share a
single `projectEdgeEndpoints` helper (DRY follow-up).
