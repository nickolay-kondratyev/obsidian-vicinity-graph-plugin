---
id: nid_hxvixo4srwy6t2gsy7v4ef4uj_E
title: "Collapse edges to/from folder groups into a single (bidirectional) arrow"
status: open
deps: []
links: []
created_iso: 2026-07-21T22:25:51Z
status_updated_iso: 2026-07-21T22:25:51Z
type: feature
priority: 2
assignee: CC_WITH-nickolaykondratyev
external-ref: spec:docs-internal/vicinity-graph-specs/arrows.md
tags: [ui, graph, edges]
---

## Problem

When many notes inside a folder group (e.g. `thoughts`/"th") link to or from a
central node (e.g. `Epictetus`), the graph draws ONE arrow per member. The
result is a dense fan of near-parallel lines converging on the group box — clutter
with little added meaning. See the motivating screenshot behavior: dozens of
arrows from Epictetus into the "th" group.

Goal: collapse those into a SINGLE arrow between the node and the GROUP box. When
both directions exist (some members link TO the node, some FROM it), draw ONE
straight line with an arrowhead at EACH end (bidirectional). Union the collapsed
relationships; sum the link counts into the "×N" badge.

## Feasibility (already researched)

Feasible without hacks. Full research + design lives in
`docs-internal/vicinity-graph-specs/arrows.md` (READ IT FIRST). Key points below.

Rendered edges come from ONE pure function `vicinityGraphToFlow`
(`src/view/flowMapping.ts`), which today maps each engine `GraphEdge` to a
`FlowEdge` connecting the two real note endpoints. The needed "project a grouped
member endpoint onto its `folderGroupIdOf(folder)` then dedupe" transform ALREADY
exists for layout: `projectedRootEdges` in `src/view/elkMapping.ts`. We mirror
that pattern for the RENDERED edge set.

## Implementation plan (3 additive edits, NO engine changes)

### 1. Collapse in `src/view/flowMapping.ts` (core, pure, node-testable)
- Only when `graph.viewSettings.groupByFolder` is on. Reuse `deriveFolderGroups`
  (already called there) to get `groupFolderByMemberPath`.
- `projectId(path) = groupFolderByMemberPath.has(path) ? folderGroupIdOf(folder) : path`.
- For each engine edge compute `projSource`/`projTarget`:
  - `projSource === projTarget` (intra-group, same box): KEEP as the real
    member-to-member `FlowEdge` unchanged — it is inside the container, not
    clutter, and collapsing would make a group self-loop.
  - else (cross-boundary): collapse. Accumulate by the UNORDERED pair
    `{projSource, projTarget}`, tracking whether A->B and/or B->A were seen and
    the SUMMED `count` of all contributing edges.
- Emit ONE `FlowEdge` per collapsed unordered pair: both directions -> mark
  bidirectional; one direction -> single arrowhead at target; `count` = sum.
- Deterministic ordering (first-seen) — no Math.random/sort surprises.
- Extend `FlowEdge` (in flowMapping.ts): add a `bidirectional` boolean (or
  reuse/rename `hasOpposite`). Non-collapsed edges keep existing semantics.

### 2. `src/view/FolderGroupNode.tsx` — add hidden RF handles (PREREQUISITE)
- React Flow anchors edges to a node's `<Handle>`; the custom `VicinityEdge`
  reads the `sourceX/Y`,`targetX/Y` RF derives from handle bounds.
- `NoteNode` (`src/view/NoteNode.tsx`) renders `<Handle type="target" Top>` +
  `<Handle type="source" Bottom>`; `FolderGroupNode` renders NONE, so a
  collapsed edge pointed at a group id has nowhere to attach.
- Add the same pair of handles to `FolderGroupNode`, visually hidden, with
  `isConnectable={false}` (mirror NoteNode). Groups stay non-interactive for
  links; they only become edge-addressable.

### 3. `src/view/edgeGeometry.ts` + `src/view/VicinityEdge.tsx` — 2nd arrowhead
- `edgeGeometry.edgePathFor` currently returns one arrow anchor at the target.
  Add a symmetric SOURCE-side anchor (reuse `arrowFromApproach` with the
  reversed approach vector — inset back from the source along the outgoing
  tangent).
- `VicinityEdge` draws a second `<polygon>` arrowhead when the edge is
  bidirectional. Bidirectional collapsed edge = single STRAIGHT line, two
  arrowheads (no curve).

### Layout modes
Collapse is a render-set transform only (RF draws edges from node positions), so
it works in `radial`, `force`, `layered` unchanged. elk already projects
cross-boundary edges onto containers for the SEPARATE_CHILDREN modes.

## Tests (start with FAILING tests)
- `src/view/flowMapping.test.ts`: many members -> one collapsed arrow, `count` =
  sum of member link counts.
- Opposite directions across the same group (A->member and otherMember->A) ->
  one bidirectional arrow.
- Intra-group edges stay member-to-member (no group self-loop).
- `groupByFolder` off -> behavior unchanged (no projection).
- One-direction-only group -> single arrowhead.
- `src/view/edgeGeometry.test.ts`: source-side anchor angle/inset symmetric to
  target anchor.

## Out of scope (optional follow-up)
Generalizing the single-line-two-arrowheads form to ALL note<->note
bidirectional pairs (retiring the curved-pair `hasOpposite` + `EDGE_PAIR_CURVATURE_PX`
mechanism in edgeGeometry). Keep this ticket to group-collapse; if we want the
unification, split a separate ticket. DRY follow-up: extract a shared
`projectEdgeEndpoints` helper used by both flowMapping and elkMapping.

## Verify
Build + run the plugin in the dev vault; open a note like `Epictetus` with a
member-heavy linked folder and confirm the fan collapses to one arrow per group
and bidirectional groups show two arrowheads. `npm test` green.

