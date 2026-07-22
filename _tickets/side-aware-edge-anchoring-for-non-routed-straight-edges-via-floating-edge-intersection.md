---
id: nid_var2o7krxq7ribq3iofni3aw1_e
title: "Side-aware edge anchoring for non-routed (straight) edges via floating-edge intersection"
status: open
deps: [nid_wku3029kwmnei7e86rbb1dk7w_e]
links: [nid_wku3029kwmnei7e86rbb1dk7w_e]
created_iso: 2026-07-22T20:37:35Z
status_updated_iso: 2026-07-22T20:37:35Z
type: feature
priority: 2
assignee: CC_WITH-nickolaykondratyev
---

## Problem

Arrows do not attach to the logically nearest side of a node. Every edge leaves the
source's BOTTOM-centre and enters the target's TOP-centre because handles are
hard-coded: `src/view/NoteNode.tsx:68,91` (`target=Position.Top`,
`source=Position.Bottom`) and the same pair on `src/view/FolderGroupNode.tsx:26-50`.
So an arrow arriving from above a node can wrap around and "drive into" it from the
bottom. Evidence screenshot: `.tmp/Screenshot From 2026-07-22 14-30-31.png` (not
source-controlled).

## Scope — non-routed edges only

Linked ticket `nid_wku3029kwmnei7e86rbb1dk7w_e` (do that one FIRST) clips routed
polylines to the endpoint rect border, which already gives side-aware anchoring for
all ROUTED edges (routing ON + force/layered — the default). This ticket covers the
remaining straight-line renders:

- routing toggled OFF (`edgeRouting` ViewSetting);
- `radial` layout (`ROUTING_SKIPPED_LAYOUT_MODE`, `src/view/GraphViewController.ts:345-349`);
- wasm/router failure fallback;
- edges absent from the route map.

## Proposed approach — React Flow "floating edge" intersection in `VicinityEdge`

Standard RF pattern: instead of using the RF-supplied handle-derived
`sourceX/Y,targetX/Y`, `src/view/VicinityEdge.tsx:41-92` looks up both endpoint nodes
via `useInternalNode(source)` / `useInternalNode(target)`, derives each node's
absolute rect, and computes the intersection of the centre→centre segment with each
rect border. Those two boundary points become the straight edge's endpoints (fed into
the existing `edgePathFor`, `src/view/edgeGeometry.ts`).

- Keep the intersection math as a pure helper in `src/view/edgeGeometry.ts`
  (`rectBorderIntersection(rect, towardPoint)`), vitest-testable; note it can share
  logic with the clip helper from the linked ticket (DRY — same segment-vs-rect
  border math).
- Subflow children: use absolute positions (RF internals provide
  `internals.positionAbsolute`), matching how the routed path already receives
  absolute coords (`src/view/edgeGeometry.ts:229-232` comment).
- Existing hidden handles stay (RF requires a handle for edge addressability per
  `docs-internal/vicinity-graph-specs/arrows.md` section 2); only the drawn geometry
  stops using their positions.
- `hasOpposite` bow (quadratic pair curve) must still work from the new endpoints.

## Interaction notes / risks

- Bidirectional double-arrowhead edges: both arrowheads recompute from the new
  chord — covered by existing geometry code, verify via tests.
- Edge label/badge midpoint shifts slightly (chord is shorter): acceptable.
- Do NOT change layout behavior — this is render-only geometry.

## Spec & tests

- Spec: add to `docs-internal/vicinity-graph-specs/arrows.md`: a straight
  (non-routed) edge anchors at the intersection of the centre→centre line with each
  endpoint's boundary, so arrows enter on the facing side.
- Unit (BDD, `src/view/edgeGeometry.test.ts`): target above/below/left/right/diagonal
  → intersection lands on the facing side; overlapping rects degenerate fallback.
- E2E: radial-layout fixture — assert an edge whose target is below its source
  attaches to the target's TOP border region (or screenshot capture if geometry
  assertion is flaky, called out explicitly).

## Acceptance criteria

- Non-routed straight edges (routing OFF and radial layout) originate/terminate on
  the facing sides of both endpoints (notes AND folder groups).
- No regression in routed rendering, bidirectional arrowheads, or `hasOpposite` bow.
- Spec updated; unit tests pass; full `npm test` + e2e green.
