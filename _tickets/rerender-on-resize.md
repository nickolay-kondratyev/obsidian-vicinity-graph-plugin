---
closed_iso: 2026-08-04T18:44:54Z
id: nid_9ep12hkmk4zjv2p28emmrhieq_e
title: Rerender on resize - poke if can be improved
status: closed
deps: []
links: []
created_iso: '2026-08-04T18:32:19Z'
status_updated_iso: 2026-08-04T18:44:54Z
type: null
priority: null
assignee: nickolaykondratyev
pwd: /home/nickolaykondratyev/git_repos/nickolay-kondratyev_obsidian-vicinity-graph-plugin
---
Right now we just recently simplified to ALWAYS re-render the layout on resize.

However, If there was enough space for the node to be resized then its a bit odd to retrigger the layout resize.

I am wondering whether it's straightforward to adjust to retrigger layout ONLY when there was overlap with nodes after resize and otherwise keep the layout as it was.

## Resolution (2026-08-04) — done, it was straightforward

Yes. The layout the reuse path would keep is already in memory
(`GraphViewController.positions` — ABSOLUTE top-left corners for note nodes AND
folder-group containers — plus `groupDimensions`), and a resize never moves a
node's origin (only right/bottom/corner grips exist), so the new box lands
exactly at the old top-left. That makes the question plain rectangle geometry.

- NEW pure module `src/view/layoutFit.ts` —
  `resizedNodesFitRenderedLayout(resizedPaths, nodes, layout)`: each resized
  node's NEW box, at its EXISTING position, must not overlap any other node,
  must not overlap a folder-group box it does not belong to, and (when it is a
  group member) must stay inside its own group's border. Conservative: geometry
  it cannot see (no layout yet, a node with no cached position) answers "no
  fit" ⇒ relayout.
- `src/view/GraphStructureDiff.ts`: `anySizeOverrideChanged` became
  `resizedPaths` (same equality seam, `sameNodeSizeOverridePx`), and the
  unconditional relayout became `resized.size > 0 && !fits`. `decideLayout` takes
  the rendered layout as a 4th argument; the controller passes what it holds.
- The growth THRESHOLD now SKIPS a just-resized node — otherwise a big-but-fitting
  resize would relayout through the back door. It is left to PASSIVE growth,
  which is all it was ever meant to damp.
- WHY-NOT a required clearance between boxes: plain overlap is the honest
  question; a second spacing number here would be a second opinion on the
  layout's own knobs. A user who drags to within a hair of a neighbour drags
  a little further.

Side benefit: a fitting resize no longer bumps `layoutVersion`, so it no longer
refits the viewport either — that shrinks ticket `nid_ct22qotgtw4rezbdn5m0diyb3_e`
(noted there) to the colliding case, without pre-empting its decision.

Tests: 11 new BDD cases in `src/view/layoutFit.test.ts`, the size-override block
of `src/view/GraphStructureDiff.test.ts` rewritten around fit-vs-collide, and a
real-Obsidian tripwire in `e2e/nodeResize.e2e.ts` ("a committed resize that still
FITS leaves the rest of the graph where it was") — verified to FAIL against the
old unconditional-relayout rule. `npm test` (1588 passed), `npm run check`,
`npm run test:e2e -- nodeResize.e2e.ts` (9) all green.

Docs: README *Node size*, `docs-internal/plan/high-level-plan.md` (Layout
stability), `docs-internal/architecture-map.md`.
