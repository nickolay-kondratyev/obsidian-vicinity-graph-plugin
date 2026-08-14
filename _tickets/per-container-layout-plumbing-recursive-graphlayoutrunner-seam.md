---
closed_iso: 2026-08-14T02:27:54Z
session_ids: [{"a": "claude", "type": "execution", "id": "26616337-7afa-430e-b450-ed0debea7131"}, {"a": "claude", "type": "review", "id": "125c5471-5249-445f-a6f5-f5cba8d95e89"}]
working_dir: nickolay-kondratyev_obsidian-vicinity-graph-plugin-mirror-1
id: nid_as3hdgn25pbxttimy643f46v7_e
title: "Per-container layout plumbing: recursive GraphLayoutRunner seam"
status: closed
deps: [nid_d44vbnq9o6rhuelfwclx2e34n_e]
links: []
created_iso: 2026-08-14T00:18:09Z
status_updated_iso: 2026-08-14T02:27:54Z
type: feature
priority: 3
assignee: nickolaykondratyev
tags: []
---

Follow-up enabler from recursive-grouping plan nid_xko67wo2z4awg5gdrm1xx1chz_e (signed-off D5). Pure seam, NO default behavior change.

Today src/view/GraphLayoutRunner.ts runs elk then, iff the ROOT uses ELK_FORCE_ALGORITHM, applies refineForceRootLayout (src/view/d3ForceRefinement.ts) to root.children only - group interiors are never refined. refineForceRootLayout is already generic over any ElkNode, and after layout each container ElkNode carries its children AND its intra-group edges (attached per elk contract in src/view/elkMapping.ts).

Build the seam: recurse into laidOut.children in GraphLayoutRunner; per container, decide (via the container algorithm marker, mirroring the root check) whether to run refinement. With every container still on rectpacking, output is byte-identical to today - assert that in tests. This unblocks the edge-aware interior evaluation ticket without touching visuals.

## Resolution (2026-08-14)

Done. Pure seam, no default behavior change — asserted byte-identical.

**What changed**

- `src/view/GraphLayoutRunner.ts`: replaced the single root-only check with a
  private `refineContainers(node, forceLayout)` recursion. It walks the
  laid-out elk tree BOTTOM-UP: each child container is refined first (its
  interior settles before its parent places it as a fixed-size box), then, iff
  THIS node's `layoutOptions["elk.algorithm"] === ELK_FORCE_ALGORITHM`, its
  direct children are refined via the existing generic `refineForceRootLayout`.
  Leaves (no `children`) are returned untouched. `layout()` now just returns
  `refineContainers(await elk.layout(graph), forceLayout)`.
- The decision is PER CONTAINER, keyed on that container's own algorithm marker
  — exactly the root check, applied at every level. Today only the root is
  `force`; every folder container is `rectpacking` (`elkGroupMemberOptions`),
  so no interior is refined.

**Why it's byte-identical today.** For a rectpacking container,
`refineContainers` returns `{...container, children: leaves.map(refine)}` where
each leaf is returned by reference — a deep-equal shallow copy. The root
(`force`) then runs `refineForceRootLayout` over those containers reading the
identical id/width/height/x/y, so every position is unchanged.

**Test.** `src/view/GraphLayoutRunner.test.ts` gains a `twoFolderGraph` fixture
(hub + `alpha`/`beta` folder groups with intra-group edges + a loose leaf) and
a suite that reconstructs the EXACT pre-recursion algorithm inline — elk once
(`ElkLayoutRunner`) then `refineForceRootLayout` on the ROOT only — and asserts
`extractElkPositions(actual)` equals it. `extractElkPositions` recurses into
containers, so group-member positions are part of the byte-identity claim.

**Verification.** `npm test` (2024 passed) + `tsc -noEmit` clean. e2e not run:
output is provably byte-identical (asserted), so there is no rendered-graph
change for the e2e matrix to catch — this is layout-runner logic fully covered
by the node suite, not a DOM/CSS change.

**For the next reader (edge-aware interior ticket).** The seam is live: flip a
folder container's `elk.algorithm` to `ELK_FORCE_ALGORITHM` in
`elkGroupMemberOptions`/`elkMapping.ts` and its interior will refine through the
same d3 pass. Note `refineForceRootLayout` re-centres its bodies' centroid at
the origin (`recentre`), so a container's members would come out in a
centroid-at-origin frame — that container-local coordinate frame is the thing
that ticket must reconcile (elk expects child coords relative to the
container's top-left). Not a problem today because no container refines.


## Notes

**2026-08-14T02:29:52Z**

__READY_AS_IS__: Pure recursive seam; byte-identity verified (test reconstructs old root-only algorithm), check clean, 2024 tests pass. No bugs found.
